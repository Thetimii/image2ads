'use client'

import { useState } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import ChatGenerator from '@/components/ChatGenerator'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/validations'

interface GeneratorPageWrapperProps {
  user: User
  profile: Profile
}

export default function GeneratorPageWrapper({ user, profile }: GeneratorPageWrapperProps) {
  const [showUpgrade, setShowUpgrade] = useState(false)

  const handleLockedFeature = () => {
    setShowUpgrade(true)
  }

  return (
    <DashboardLayout user={user} profile={profile}>
      <ChatGenerator 
        user={user} 
        profile={profile} 
        onLockedFeature={handleLockedFeature}
      />
      
      {/* Upgrade Modal */}
      {showUpgrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Upgrade Required</h2>
            <p className="text-sm text-gray-600 leading-relaxed">This feature is part of our Pro plan. Unlock image refinements and still-to-video animations plus faster generation speeds.</p>
            <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
              <li>Access Image → Image & Image → Video</li>
              <li>Higher resolutions & longer clips (soon)</li>
              <li>More generation enhancements as we roll them out</li>
            </ul>
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setShowUpgrade(false)} 
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm hover:bg-gray-50"
              >
                Maybe later
              </button>
              <button 
                onClick={() => { setShowUpgrade(false); window.location.href = '/billing' }} 
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-md px-3 py-2 text-sm font-medium shadow hover:brightness-110"
              >
                Upgrade
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}