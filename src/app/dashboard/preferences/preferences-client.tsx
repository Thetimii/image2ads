'use client'

import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/validations'
import DashboardLayout from '@/components/DashboardLayout'

interface PreferencesClientProps {
  user: User
  profile: Profile
}

export default function PreferencesClient({ user, profile }: PreferencesClientProps) {
  const [preferences, setPreferences] = useState({
    notifications: {
      email: true,
      browser: true,
      jobComplete: true,
      weeklyReport: false,
    },
    appearance: {
      theme: 'light',
      compactMode: false,
    }
  })

  const [isSaving, setIsSaving] = useState(false)

  const handleSavePreferences = async () => {
    setIsSaving(true)
    // TODO: Implement save preferences API call
    setTimeout(() => {
      setIsSaving(false)
    }, 1000)
  }

  return (
    <DashboardLayout user={user} profile={profile}>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Preferences</h1>
          <p className="text-gray-600">
            Customize your experience and manage your account settings.
          </p>
        </div>

        <div className="max-w-4xl">
          {/* Notifications */}
          <div className="bg-white rounded-2xl border border-gray-200 mb-6 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Notifications</h2>
              <p className="text-sm text-gray-600">Control how and when you receive notifications.</p>
            </div>
            
            <div className="p-6 space-y-4">
              {[
                { key: 'email', label: 'Email notifications', description: 'Receive updates via email' },
                { key: 'browser', label: 'Browser notifications', description: 'Show notifications in your browser' },
                { key: 'jobComplete', label: 'Job completion alerts', description: 'Get notified when ad generation is complete' },
                { key: 'weeklyReport', label: 'Weekly summary', description: 'Receive a weekly usage report' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-gray-900">{item.label}</p>
                    <p className="text-sm text-gray-500">{item.description}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.notifications[item.key as keyof typeof preferences.notifications]}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        notifications: {
                          ...preferences.notifications,
                          [item.key]: e.target.checked
                        }
                      })}
                      className="sr-only"
                    />
                    <div className={`
                      w-11 h-6 rounded-full transition-colors duration-200
                      ${preferences.notifications[item.key as keyof typeof preferences.notifications] 
                        ? 'bg-blue-600' 
                        : 'bg-gray-300'
                      }
                    `}>
                      <div className={`
                        w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 mt-0.5
                        ${preferences.notifications[item.key as keyof typeof preferences.notifications] 
                          ? 'translate-x-5' 
                          : 'translate-x-0.5'
                        }
                      `}></div>
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Appearance */}
          <div className="bg-white rounded-2xl border border-gray-200 mb-6 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Appearance</h2>
              <p className="text-sm text-gray-600">Customize the look and feel of your dashboard.</p>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Theme */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Theme</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'light', label: 'Light', icon: '☀️' },
                    { value: 'dark', label: 'Dark', icon: '🌙' },
                  ].map((theme) => (
                    <label key={theme.value}>
                      <input
                        type="radio"
                        name="theme"
                        value={theme.value}
                        checked={preferences.appearance.theme === theme.value}
                        onChange={(e) => setPreferences({
                          ...preferences,
                          appearance: { ...preferences.appearance, theme: e.target.value }
                        })}
                        className="sr-only"
                      />
                      <div className={`
                        p-4 text-center rounded-xl border-2 cursor-pointer transition-all duration-200
                        ${preferences.appearance.theme === theme.value 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                        }
                      `}>
                        <div className="text-2xl mb-2">{theme.icon}</div>
                        <p className={`font-medium ${preferences.appearance.theme === theme.value ? 'text-blue-700' : 'text-gray-900'}`}>
                          {theme.label}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Compact Mode */}
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-gray-900">Compact mode</p>
                  <p className="text-sm text-gray-500">Use a more condensed layout</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.appearance.compactMode}
                    onChange={(e) => setPreferences({
                      ...preferences,
                      appearance: { ...preferences.appearance, compactMode: e.target.checked }
                    })}
                    className="sr-only"
                  />
                  <div className={`
                    w-11 h-6 rounded-full transition-colors duration-200
                    ${preferences.appearance.compactMode ? 'bg-blue-600' : 'bg-gray-300'}
                  `}>
                    <div className={`
                      w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 mt-0.5
                      ${preferences.appearance.compactMode ? 'translate-x-5' : 'translate-x-0.5'}
                    `}></div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSavePreferences}
              disabled={isSaving}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-500/20"
            >
              {isSaving ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </div>
              ) : (
                'Save Preferences'
              )}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}