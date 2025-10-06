'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { Profile, Folder } from '@/lib/validations'
import DashboardLayout from '@/components/DashboardLayout'
import DemoWorkflow from '@/components/DemoWorkflow'
import ChatInterface from '@/components/ChatInterface'
import { createClient } from '@/lib/supabase/client'

interface DashboardClientProps {
  user: User
  profile: Profile
  initialFolders: Folder[]
}

export default function DashboardClient({ user, profile, initialFolders }: DashboardClientProps) {
  const [showDemo, setShowDemo] = useState(false)
  const router = useRouter()
  const supabase = createClient()

    // Show demo for new users who haven't completed tutorial
  useEffect(() => {
    console.log('Dashboard: checking demo status:', { 
      tutorial_completed: profile.tutorial_completed
    })
    
    // Temporarily disable demo - user can manually trigger it from header
    // if (!profile.tutorial_completed) {
    //   setShowDemo(true)
    // }
  }, [profile.tutorial_completed])

  const handleDemoComplete = async () => {
    try {
      // Mark tutorial as completed in database
      const { error } = await supabase
        .from('profiles')
        .update({ tutorial_completed: true })
        .eq('id', user.id)

      if (error) {
        console.error('Error marking tutorial as completed:', error)
      }

      setShowDemo(false)
    } catch (error) {
      console.error('Error completing demo:', error)
    }
  }

  return (
    <DashboardLayout user={user} profile={profile} onDemoOpen={() => setShowDemo(true)}>
      <ChatInterface user={user} profile={profile} />

      {/* Tutorial Overlay - Commented out for now */}
      {/* <DemoWorkflow 
        isOpen={showDemo} 
        onClose={() => setShowDemo(false)}
        onComplete={handleDemoComplete}
      /> */}
    </DashboardLayout>
  )
}