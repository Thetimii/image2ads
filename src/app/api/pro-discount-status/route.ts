import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get profile with discount popup info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('pro_discount_popup_shown_at, pro_discount_popup_expired, credits, tutorial_completed')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Check if popup was never shown
    if (!profile.pro_discount_popup_shown_at) {
      return NextResponse.json({
        is_valid: false,
        minutes_left: 0,
        seconds_left: 0,
        should_show_popup: profile.credits === 1 && profile.tutorial_completed,
        popup_never_shown: true,
      })
    }

    // Calculate time difference
    const shownAt = new Date(profile.pro_discount_popup_shown_at)
    const now = new Date()
    const diffMs = now.getTime() - shownAt.getTime()
    const diffMinutes = Math.floor(diffMs / 60000)
    const diffSeconds = Math.floor((diffMs % 60000) / 1000)

    // Check if expired
    if (diffMinutes >= 15 || profile.pro_discount_popup_expired) {
      // Mark as expired if not already
      if (!profile.pro_discount_popup_expired) {
        await supabase
          .from('profiles')
          .update({ pro_discount_popup_expired: true })
          .eq('id', user.id)
      }

      return NextResponse.json({
        is_valid: false,
        minutes_left: 0,
        seconds_left: 0,
        should_show_popup: false,
        popup_never_shown: false,
      })
    }

    // Calculate remaining time
    const minutesLeft = 14 - diffMinutes // 0-14 minutes remaining
    const secondsLeft = 60 - diffSeconds // seconds within current minute

    return NextResponse.json({
      is_valid: true,
      minutes_left: minutesLeft,
      seconds_left: secondsLeft,
      should_show_popup: false,
      popup_never_shown: false,
    })

  } catch (error) {
    console.error('Error checking pro discount status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST to mark popup as shown (starts the timer)
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Mark popup as shown (start timer)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        pro_discount_popup_shown_at: new Date().toISOString(),
        pro_discount_popup_expired: false 
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error marking popup as shown:', updateError)
      return NextResponse.json(
        { error: 'Failed to update popup status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      timer_started: true,
    })

  } catch (error) {
    console.error('Error starting pro discount timer:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
