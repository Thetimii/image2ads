'use client'

import { useEffect, useState } from 'react'
import { useSupabaseUser } from '@/hooks/useSupabaseUser'

interface AuthDebugInfo {
  hasUser: boolean
  userId?: string
  sessionExists: boolean
  cookiesPresent: boolean
  environment: string
  supabaseUrl: string
  timestamp: string
  error?: string
}

export default function AuthDebug() {
  const { user, loading } = useSupabaseUser()
  const [debugInfo, setDebugInfo] = useState<AuthDebugInfo | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const checkAuth = () => {
      try {
        // Check for auth cookies
        const authCookies = document.cookie
          .split(';')
          .filter(cookie => cookie.trim().includes('sb-'))
        
        setDebugInfo({
          hasUser: !!user,
          userId: user?.id,
          sessionExists: !!user,
          cookiesPresent: authCookies.length > 0,
          environment: process.env.NODE_ENV || 'unknown',
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'missing',
          timestamp: new Date().toISOString(),
          error: undefined
        })
      } catch (err) {
        setDebugInfo({
          hasUser: false,
          sessionExists: false,
          cookiesPresent: false,
          environment: process.env.NODE_ENV || 'unknown',
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'missing',
          timestamp: new Date().toISOString(),
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      }
    }

    if (!loading) {
      checkAuth()
    }
  }, [user, loading])

  // Only show in development or when URL contains ?debug=auth
  useEffect(() => {
    const showDebug = process.env.NODE_ENV === 'development' || 
                     (typeof window !== 'undefined' && window.location.search.includes('debug=auth'))
    setIsVisible(showDebug)
  }, [])

  if (!isVisible || !debugInfo) return null

  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-white p-4 rounded-lg text-xs font-mono max-w-sm z-50">
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold">🔐 Auth Debug</span>
        <button 
          onClick={() => setIsVisible(false)}
          className="text-white/70 hover:text-white"
        >
          ×
        </button>
      </div>
      <div className="space-y-1">
        <div className={`flex justify-between ${debugInfo.hasUser ? 'text-green-400' : 'text-red-400'}`}>
          <span>User:</span>
          <span>{debugInfo.hasUser ? '✅' : '❌'}</span>
        </div>
        {debugInfo.userId && (
          <div className="text-xs text-gray-400">
            ID: {debugInfo.userId.slice(0, 8)}...
          </div>
        )}
        <div className={`flex justify-between ${debugInfo.sessionExists ? 'text-green-400' : 'text-red-400'}`}>
          <span>Session:</span>
          <span>{debugInfo.sessionExists ? '✅' : '❌'}</span>
        </div>
        <div className={`flex justify-between ${debugInfo.cookiesPresent ? 'text-green-400' : 'text-red-400'}`}>
          <span>Cookies:</span>
          <span>{debugInfo.cookiesPresent ? '✅' : '❌'}</span>
        </div>
        <div className="text-gray-400">
          Env: {debugInfo.environment}
        </div>
        <div className="text-gray-400">
          URL: {debugInfo.supabaseUrl.slice(0, 20)}...
        </div>
        {debugInfo.error && (
          <div className="text-red-400 text-xs mt-2">
            Error: {debugInfo.error}
          </div>
        )}
        <div className="text-gray-500 text-xs mt-2">
          {debugInfo.timestamp.split('T')[1].slice(0, 8)}
        </div>
      </div>
    </div>
  )
}