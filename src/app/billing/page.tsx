import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/database'
import { redirect } from 'next/navigation'
import BillingClient from './billing-client'

export default async function BillingPage() {
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
    <Suspense fallback={<div>Loading...</div>}>
      <BillingClient 
        user={user} 
        profile={profile} 
      />
    </Suspense>
  )
}