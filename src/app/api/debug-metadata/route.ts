import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const fileName = searchParams.get('file')

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (fileName) {
      // Debug specific file
      const { data: metadata, error } = await supabase
        .from('generated_ads_metadata')
        .select('*')
        .eq('file_name', fileName)

      return NextResponse.json({ 
        fileName,
        metadata,
        error: error?.message 
      })
    } else {
      // Debug all metadata for user
      const { data: allMetadata, error } = await supabase
        .from('generated_ads_metadata')
        .select('*')
        .eq('user_id', user.id)

      return NextResponse.json({ 
        userId: user.id,
        allMetadata,
        count: allMetadata?.length || 0,
        error: error?.message 
      })
    }

  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}