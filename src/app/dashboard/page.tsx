import { createClient } from '@/lib/supabase/server'
import { getUserFolders, getUserProfile } from '@/lib/database'
import { redirect } from 'next/navigation'
import DashboardClient from './dashboard-client'

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

  return (
    <DashboardClient 
      user={user} 
      profile={profile} 
      initialFolders={folders} 
    />
  )
}