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

    // Get profile with discount expiry info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('pro_discount_expires_at, credits, tutorial_completed')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Check if discount was never activated
    if (!profile.pro_discount_expires_at) {
      return NextResponse.json({
        is_valid: false,
        minutes_left: 0,
        seconds_left: 0,
        should_show_popup: profile.credits === 1 && profile.tutorial_completed,
        discount_never_activated: true,
      })
    }

    // Calculate remaining time until expiry
    const expiresAt = new Date(profile.pro_discount_expires_at)
    const now = new Date()
    const remainingMs = expiresAt.getTime() - now.getTime()

    // Check if expired
    if (remainingMs <= 0) {
      return NextResponse.json({
        is_valid: false,
        minutes_left: 0,
        seconds_left: 0,
        should_show_popup: false,
        discount_never_activated: false,
      })
    }

    // Calculate remaining time
    const totalSeconds = Math.floor(remainingMs / 1000)
    const minutesLeft = Math.floor(totalSeconds / 60)
    const secondsLeft = totalSeconds % 60

    return NextResponse.json({
      is_valid: true,
      minutes_left: minutesLeft,
      seconds_left: secondsLeft,
      should_show_popup: false,
      discount_never_activated: false,
    })

  } catch (error) {
    console.error('Error checking pro discount status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST to activate discount (sets expiry to NOW + 15 minutes)
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

    // Set expiry to NOW + 15 minutes
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 15)

    console.log('💾 Activating Pro discount for user:', user.id)
    console.log('⏰ Expiry time will be:', expiresAt.toISOString())

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        pro_discount_expires_at: expiresAt.toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('❌ Error activating discount:', updateError)
      return NextResponse.json(
        { error: 'Failed to activate discount' },
        { status: 500 }
      )
    }

    console.log('✅ Pro discount activated successfully')

    return NextResponse.json({
      success: true,
      expires_at: expiresAt.toISOString(),
    })

  } catch (error) {
    console.error('Error activating pro discount:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
