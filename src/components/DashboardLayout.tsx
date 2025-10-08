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

interface NavItem { name: string; href: string; locked?: boolean }
const navigation: NavItem[] = [
  { name: '📝 Text to Image', href: '/dashboard/generate/text-to-image' },
  { name: '🖼️ Image to Image', href: '/dashboard/generate/image-to-image' },
  { name: '🎥 Text to Video', href: '/dashboard/generate/text-to-video', locked: true },
  { name: '📸 Image to Video', href: '/dashboard/generate/image-to-video', locked: true },
  { name: '📚 Library', href: '/dashboard/library' },
]

const bottomNavigation = [
  {
    name: '💳 Usage & Billing',
    href: '/billing',
  },
  {
    name: '⚙️ Settings',
    href: '/dashboard/settings',
  },
]

export default function DashboardLayout({ user, profile, children, onDemoOpen }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isSafari, setIsSafari] = useState(false)
  const [loadingPath, setLoadingPath] = useState<string | null>(null)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  
  // Generator context removed for now to fix build issues
  const generator = null

  useEffect(() => {
    // Detect Safari
    const userAgent = navigator.userAgent.toLowerCase();
    setIsSafari(userAgent.includes('safari') && !userAgent.includes('chrome'));
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  // Determine if user has pro (stripe customer ID)
  const hasPro = !!profile.stripe_customer_id

  const handleNavigation = (href: string) => {
    if (href === pathname) return

    // Check locked
    const navItem = navigation.find(n => n.href === href)
    if (navItem?.locked && !hasPro) {
      setShowUpgrade(true)
      return
    }
    
    // Close sidebar immediately for instant feel
    setSidebarOpen(false)
    
    // Generator context removed for build fix - navigation will work without this
    
    // Use router.push for proper Next.js navigation
    router.push(href)
  }

  // Clear loading state when pathname changes
  useEffect(() => {
    setLoadingPath(null)
  }, [pathname])

  const isCurrentPath = (href: string) => {
    // Always check pathname for instant visual update
    return pathname === href
  }

  return (
    <div className="h-screen bg-gray-50 flex">
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
              <div className="w-14 h-9 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center">
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
            {navigation.map((item) => {
              const isLocked = item.locked && !hasPro
              return (
                <button
                  key={item.name}
                  onClick={() => handleNavigation(item.href)}
                  disabled={loadingPath === item.href}
                  className={`relative group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-150 w-full text-left
                    ${isCurrentPath(item.href)
                      ? 'bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700'
                      : 'text-gray-700 hover:bg-purple-50/50 hover:text-purple-600'}
                    ${loadingPath === item.href ? 'opacity-75' : ''}
                    ${isLocked ? 'opacity-60 blur-[0.2px] cursor-not-allowed' : ''}
                  `}
                >
                  <span>{item.name}{isLocked && ' 🔒'}</span>
                </button>
              )
            })}
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
                  group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-150 w-full text-left
                  ${isCurrentPath(item.href)
                    ? 'bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700'
                    : 'text-gray-700 hover:bg-purple-50/50 hover:text-purple-600'
                  }
                  ${loadingPath === item.href ? 'opacity-75' : ''}
                `}
              >
                {loadingPath === item.href ? (
                  <>
                    <span className="mr-3">
                      <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                    </span>
                    <span>{item.name}</span>
                    <span className="ml-auto text-xs text-purple-500">Loading...</span>
                  </>
                ) : (
                  <span>{item.name}</span>
                )}
              </button>
            ))}
            
            {/* Sign out button */}
            <button
              onClick={handleSignOut}
              className="w-full group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 text-gray-700 hover:bg-red-50 hover:text-red-700"
            >
              🚪 Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden lg:ml-64">
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
                  <button onClick={() => setShowUpgrade(false)} className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm hover:bg-gray-50">Maybe later</button>
                  <button onClick={() => { setShowUpgrade(false); router.push('/billing') }} className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-md px-3 py-2 text-sm font-medium shadow hover:brightness-110">Upgrade</button>
                </div>
              </div>
            </div>
          )}
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
        <main className={`flex-1 ${
          // Enable scrolling for specific pages
          pathname === '/dashboard/library' || 
          pathname === '/dashboard/settings' || 
          pathname === '/billing'
            ? 'overflow-y-auto' 
            : 'overflow-hidden'
        }`}>
          {children}
        </main>
      </div>
    </div>
  )
}