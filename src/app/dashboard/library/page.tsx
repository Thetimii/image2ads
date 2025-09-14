import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/database'
import { redirect } from 'next/navigation'
import LibraryClient from './library-client'

export default async function LibraryPage() {
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
    <LibraryClient 
      user={user} 
      profile={profile} 
    />
  )
}