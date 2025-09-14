import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/database'
import { redirect } from 'next/navigation'
import SettingsClient from './settings-client'

export default async function SettingsPage() {
  const supabase = await createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    redirect('/signin')
  }

  const profile = await getUserProfile(user.id)

  if (!profile) {
    redirect('/signin')
  }

  return (
    <SettingsClient 
      user={user} 
      profile={profile} 
    />
  )
}