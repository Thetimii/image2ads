import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/database'
import { redirect } from 'next/navigation'
import GeneratorPageWrapper from '@/components/GeneratorPageWrapper'

// Force dynamic rendering to prevent caching issues with user sessions
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function TextToImagePage() {
  // Create a Supabase client using server-side cookies
  const supabase = await createClient()

  // ✅ Always await and verify user server-side
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    console.warn('[Auth] No valid session found, redirecting to /signin')
    redirect('/signin')
  }

  // ✅ Defensive: fetch profile only if user exists
  const profile = await getUserProfile(user.id).catch((err) => {
    console.error('[Profile] Error fetching profile', err)
    return null
  })

  if (!profile) {
    console.warn('[Profile] No profile found, redirecting to /signin')
    redirect('/signin')
  }

  // ✅ Pass to a client component that hydrates fully on the client
  return (
    <GeneratorPageWrapper
      key={user.id} // 👈 forces React to re-render properly when user changes
      user={user}
      profile={profile}
    />
  )
}
