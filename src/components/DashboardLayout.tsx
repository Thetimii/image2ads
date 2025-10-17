'use client'

import { useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/validations'
import { STRIPE_PLANS } from '@/lib/stripe-plans'
import PricingPlans from '@/components/PricingPlans'


interface DashboardLayoutProps {
  user: User
  profile: Profile
  children: ReactNode
  onDemoOpen?: () => void
  isNavigationLocked?: boolean
}

interface NavItem { name: string; href: string; locked?: boolean }
const navigation: NavItem[] = [
  { name: '📝 Text to Image', href: '/dashboard/generate/text-to-image' },
  { name: '🖼 Image to Image', href: '/dashboard/generate/image-to-image' },
  { name: '🎬 Text to Video', href: '/dashboard/generate/text-to-video', locked: true },
  { name: '🎥 Image to Video', href: '/dashboard/generate/image-to-video', locked: true },
  { name: '🎵 Text to Music', href: '/dashboard/generate/text-to-music', locked: true },
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

export default function DashboardLayout({ user, profile, children, onDemoOpen, isNavigationLocked = false }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isSafari, setIsSafari] = useState(false)
  const [loadingPath, setLoadingPath] = useState<string | null>(null)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [isUpgrading, setIsUpgrading] = useState<string | null>(null)
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

  const handleSubscribe = async (plan: 'starter' | 'pro' | 'business') => {
    setIsUpgrading(plan)
    try {
      // Create checkout session via API
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan,
          successUrl: `${window.location.origin}/billing?success=true`,
          cancelUrl: `${window.location.origin}${pathname}`,
        }),
      })

      if (response.ok) {
        const { url } = await response.json()
        window.location.href = url
      } else {
        const errorData = await response.json()
        console.error('Failed to create checkout session:', errorData.error)
        alert('Failed to start checkout. Please try again.')
        setIsUpgrading(null)
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert('Failed to start checkout. Please try again.')
      setIsUpgrading(null)
    }
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
          <button
            onClick={() => setShowUpgrade(true)}
            className="w-full px-6 py-4 border-b border-gray-200 flex-shrink-0 hover:bg-purple-50/30 transition-colors cursor-pointer text-left group"
            title="Click to get more credits"
          >
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
                  <p className="text-xs text-gray-500 group-hover:text-purple-600 transition-colors">
                    {profile.credits} credits
                  </p>
                  <span className="text-xs text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    +
                  </span>
                </div>
              </div>
            </div>
          </button>

          {/* Main navigation - Fixed height, no scrolling */}
          <nav className="flex-1 px-4 py-4 space-y-1">
            {navigation.map((item) => {
              const isLocked = item.locked && !hasPro
              const isDisabledByOnboarding = isNavigationLocked && item.href !== pathname
              const shouldDisable = isDisabledByOnboarding && !isLocked
              
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    if (isLocked) {
                      setShowUpgrade(true)
                      return
                    }
                    if (!shouldDisable) {
                      handleNavigation(item.href)
                    }
                  }}
                  disabled={loadingPath === item.href || shouldDisable}
                  className={`relative group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-150 w-full text-left
                    ${isCurrentPath(item.href)
                      ? 'bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700'
                      : 'text-gray-700 hover:bg-purple-50/50 hover:text-purple-600'}
                    ${loadingPath === item.href ? 'opacity-75' : ''}
                    ${isLocked ? 'opacity-60 blur-[0.2px] cursor-pointer' : ''}
                    ${shouldDisable ? 'cursor-not-allowed' : ''}
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
                onClick={() => !isNavigationLocked && handleNavigation(item.href)}
                disabled={loadingPath === item.href || isNavigationLocked}
                className={`
                  group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-150 w-full text-left
                  ${isCurrentPath(item.href)
                    ? 'bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700'
                    : 'text-gray-700 hover:bg-purple-50/50 hover:text-purple-600'
                  }
                  ${loadingPath === item.href ? 'opacity-75' : ''}
                  ${isNavigationLocked ? 'cursor-not-allowed' : ''}
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
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-2xl">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">✨ Upgrade Your Plan</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {hasPro 
                        ? 'Get more credits with a higher tier plan'
                        : 'Unlock video generation, music creation, and get more credits. Choose a plan to get started:'
                      }
                    </p>
                  </div>
                  <button
                    onClick={() => setShowUpgrade(false)}
                    className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                  >
                    ×
                  </button>
                </div>

                {/* Plans Grid */}
                <PricingPlans 
                  onSubscribeAction={handleSubscribe}
                  isLoading={isUpgrading}
                  variant="popup"
                />

                {/* Footer */}
                <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-2xl">
                  <p className="text-xs text-gray-500 text-center">
                    💳 Secure payment powered by Stripe • Cancel anytime • 30-day money-back guarantee
                  </p>
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