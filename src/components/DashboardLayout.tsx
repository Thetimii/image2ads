'use client'

import { useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/validations'

interface DashboardLayoutProps {
  user: User
  profile: Profile
  children: ReactNode
  onDemoOpen?: () => void
}

const navigation = [
  {
    name: 'Create',
    href: '/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    ),
  },
  {
    name: 'Library',
    href: '/dashboard/library',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
]

const bottomNavigation = [
  {
    name: 'Usage & Billing',
    href: '/billing',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    name: 'Settings',
    href: '/dashboard/settings',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
]

export default function DashboardLayout({ user, profile, children, onDemoOpen }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isSafari, setIsSafari] = useState(false)
  const [loadingPath, setLoadingPath] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    // Detect Safari
    const userAgent = navigator.userAgent.toLowerCase();
    setIsSafari(userAgent.includes('safari') && !userAgent.includes('chrome'));
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleNavigation = (href: string) => {
    if (href !== pathname) {
      setLoadingPath(href)
      router.push(href)
    }
  }

  // Clear loading state when pathname changes
  useEffect(() => {
    setLoadingPath(null)
  }, [pathname])

  const isCurrentPath = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard'
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" />
        </div>
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-screen w-64">
          {/* Header */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 flex-shrink-0">
            <Link href="/" className="flex items-center space-x-2">
              {isSafari ? (
                // Safari-specific PNG fallback
                <Image
                  src="/logo.png" 
                  alt="Image2Ad Logo" 
                  width={32}
                  height={32}
                  className="w-8 h-8"
                  style={{
                    imageRendering: 'auto'
                  } as React.CSSProperties}
                />
              ) : (
                // Standard SVG for other browsers
                <Image
                  src="/logo.svg" 
                  alt="Image2Ad Logo" 
                  width={32}
                  height={32}
                  className="w-8 h-8"
                />
              )}
              <span className="text-xl font-bold text-gray-900">Image2Ad</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 rounded-md hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* User info */}
          <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {profile.full_name || 'User'}
                </p>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <p className="text-xs text-gray-500">{profile.credits} credits</p>
                </div>
              </div>
            </div>
          </div>

          {/* Main navigation - Fixed height, no scrolling */}
          <nav className="flex-1 px-4 py-4 space-y-1">
            {navigation.map((item) => (
              <button
                key={item.name}
                onClick={() => handleNavigation(item.href)}
                disabled={loadingPath === item.href}
                className={`
                  group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 w-full text-left
                  ${isCurrentPath(item.href)
                    ? 'bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 border border-blue-200/50'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }
                  ${loadingPath === item.href ? 'opacity-75' : ''}
                `}
              >
                <span className={`
                  mr-3 transition-colors duration-200
                  ${isCurrentPath(item.href) ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'}
                `}>
                  {loadingPath === item.href ? (
                    <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                  ) : (
                    item.icon
                  )}
                </span>
                {item.name}
                {loadingPath === item.href && (
                  <span className="ml-auto text-xs text-blue-500">Loading...</span>
                )}
              </button>
            ))}
          </nav>

          {/* Try Demo Button - Commented out for now */}
          {/* {onDemoOpen && (
            <div className="px-4 py-2">
              <button
                onClick={onDemoOpen}
                className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white px-4 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 text-sm"
              >
                <span>✨</span>
                Try Demo
              </button>
            </div>
          )} */}

          {/* Bottom navigation - Always fixed at bottom */}
          <div className="px-4 py-4 border-t border-gray-200 space-y-1 flex-shrink-0 mt-auto">
            {bottomNavigation.map((item) => (
              <button
                key={item.name}
                onClick={() => handleNavigation(item.href)}
                disabled={loadingPath === item.href}
                className={`
                  group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 w-full text-left
                  ${isCurrentPath(item.href)
                    ? 'bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 border border-blue-200/50'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }
                  ${loadingPath === item.href ? 'opacity-75' : ''}
                `}
              >
                <span className={`
                  mr-3 transition-colors duration-200
                  ${isCurrentPath(item.href) ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'}
                `}>
                  {loadingPath === item.href ? (
                    <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                  ) : (
                    item.icon
                  )}
                </span>
                {item.name}
                {loadingPath === item.href && (
                  <span className="ml-auto text-xs text-blue-500">Loading...</span>
                )}
              </button>
            ))}
            
            {/* Sign out button */}
            <button
              onClick={handleSignOut}
              className="w-full group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 text-gray-700 hover:bg-red-50 hover:text-red-700"
            >
              <span className="mr-3 text-gray-400 group-hover:text-red-500 transition-colors duration-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </span>
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden lg:ml-64">
        {/* Mobile header */}
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-md hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center space-x-2">
              {isSafari ? (
                // Safari-specific PNG fallback
                <Image
                  src="/logo.png" 
                  alt="Image2Ad Logo" 
                  width={24}
                  height={24}
                  className="w-6 h-6"
                  style={{
                    imageRendering: 'auto'
                  } as React.CSSProperties}
                />
              ) : (
                // Standard SVG for other browsers
                <Image
                  src="/logo.svg" 
                  alt="Image2Ad Logo" 
                  width={24}
                  height={24}
                  className="w-6 h-6"
                />
              )}
              <span className="font-semibold text-gray-900">Image2Ad</span>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}