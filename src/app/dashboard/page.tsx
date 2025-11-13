import { createClient } from '@/lib/supabase/server'
import { getUserFolders, getUserProfile } from '@/lib/database'
import { redirect } from 'next/navigation'
import { checkAndUpdateTrialExpiration } from '@/lib/trial-utils'

// Force dynamic rendering to prevent caching issues with user sessions
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    redirect('/signin')
  }

  const [profile, folders] = await Promise.all([
    getUserProfile(user.id),
    getUserFolders(user.id),
  ])

  if (!profile) {
    redirect('/signin')
  }

  // Check if user's trial has expired and update status
  await checkAndUpdateTrialExpiration(user.id)

  // Redirect to text-to-image generator as default
  redirect('/dashboard/generate/text-to-image')
}
