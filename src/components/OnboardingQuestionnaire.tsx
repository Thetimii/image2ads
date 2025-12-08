import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import confetti from 'canvas-confetti'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/validations'

interface FirstTimeOnboardingProps {
  user: User
  profile: Profile
  onCompleteAction: (prefillPrompt: string, mode: 'product' | 'artist') => void
  onSkipAction: () => void
}

export default function OnboardingQuestionnaire({ user, profile, onCompleteAction, onSkipAction }: FirstTimeOnboardingProps) {
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)
  const [hasShownConfetti, setHasShownConfetti] = useState(false)
  const supabase = createClient()

  // Prompts
  const ARTIST_PROMPT = "A cozy French café scene with a white ceramic coffee cup on a wooden table. The cup has 'Made by You' written in elegant handwriting, surrounded by soft daylight, warm tones, and perfect latte art in the foam."
  const PRODUCT_PROMPT = "A professional studio shot of the uploaded product on a marble surface, dramatic lighting, 4k resolution."

  useEffect(() => {
    // Check if user needs onboarding
    const needsOnboarding = !profile.tutorial_completed

    if (needsOnboarding && !hasShownConfetti) {
      // Fire confetti celebration
      fireConfetti()
      setHasShownConfetti(true)

      // Show welcome modal after confetti
      setTimeout(() => {
        setShowWelcomeModal(true)
      }, 1000)
    }
  }, [profile.tutorial_completed, hasShownConfetti])

  const fireConfetti = () => {
    const duration = 2500
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 }

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min
    }

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now()

      if (timeLeft <= 0) {
        clearInterval(interval)
        return
      }

      const particleCount = 50 * (timeLeft / duration)

      // Fire confetti from random positions
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      })
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      })
    }, 250)
  }

  const handleOptionSelect = (option: 'product' | 'artist' | 'skip') => {
    setShowWelcomeModal(false)

    if (option === 'skip') {
      onSkipAction()
    } else if (option === 'product') {
      onCompleteAction(PRODUCT_PROMPT, 'product')
    } else {
      onCompleteAction(ARTIST_PROMPT, 'artist')
    }
  }

  if (!showWelcomeModal) return null

  return (
    <>
      {/* Backdrop with dark overlay - everything will be darkened */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-[9998] animate-in fade-in duration-300" />

      {/* Welcome Modal */}
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto p-4 sm:p-6"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
        }}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col md:flex-row">

          {/* Left Side: Welcome Header */}
          <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-6 md:p-8 md:w-1/3 flex flex-col justify-center text-white relative overflow-hidden shrink-0">
            <div className="absolute inset-0 bg-black/10 backdrop-blur-sm"></div>
            <div className="relative z-10 text-center md:text-left">
              <div className="text-4xl md:text-5xl mb-4 md:mb-6 animate-bounce inline-block">👋</div>
              <h2 className="text-2xl md:text-3xl font-bold mb-2 md:mb-4 leading-tight">
                Welcome to Image2Ad!
              </h2>
              <p className="text-white/90 text-base md:text-lg">
                How would you like to start your journey?
              </p>
            </div>
            {/* Decorative circles */}
            <div className="absolute -bottom-10 -left-10 w-32 h-32 md:w-40 md:h-40 bg-white/10 rounded-full blur-2xl"></div>
            <div className="absolute -top-10 -right-10 w-32 h-32 md:w-40 md:h-40 bg-white/10 rounded-full blur-2xl"></div>
          </div>

          {/* Right Side: Options */}
          <div className="p-4 md:p-8 md:w-2/3 bg-gray-50 flex flex-col justify-center overflow-y-auto">
            <div className="grid gap-4">

              <button
                onClick={() => handleOptionSelect('product')}
                className="group relative bg-white p-4 md:p-6 rounded-xl border-2 border-transparent hover:border-purple-500 shadow-sm hover:shadow-lg transition-all duration-200 text-left flex items-start gap-3 md:gap-4"
              >
                <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-full flex items-center justify-center text-xl md:text-2xl group-hover:scale-110 transition-transform">
                  📸
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base md:text-lg group-hover:text-purple-600 transition-colors">Turn Product into Ad</h3>
                  <p className="text-gray-600 text-xs md:text-sm mt-0.5 md:mt-1">Upload a product photo and let AI place it in a stunning scene.</p>
                </div>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-purple-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </div>
              </button>

              <button
                onClick={() => handleOptionSelect('artist')}
                className="group relative bg-white p-4 md:p-6 rounded-xl border-2 border-transparent hover:border-pink-500 shadow-sm hover:shadow-lg transition-all duration-200 text-left flex items-start gap-3 md:gap-4"
              >
                <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-pink-100 rounded-full flex items-center justify-center text-xl md:text-2xl group-hover:scale-110 transition-transform">
                  🎨
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base md:text-lg group-hover:text-pink-600 transition-colors">Create Art / Assets</h3>
                  <p className="text-gray-600 text-xs md:text-sm mt-0.5 md:mt-1">Describe your vision and generate high-quality images from scratch.</p>
                </div>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-pink-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </div>
              </button>

              <button
                onClick={() => handleOptionSelect('skip')}
                className="group relative bg-white p-4 md:p-6 rounded-xl border-2 border-transparent hover:border-gray-400 shadow-sm hover:shadow-md transition-all duration-200 text-left flex items-start gap-3 md:gap-4 opacity-80 hover:opacity-100"
              >
                <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-gray-100 rounded-full flex items-center justify-center text-xl md:text-2xl group-hover:scale-110 transition-transform">
                  🚀
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base md:text-lg group-hover:text-gray-700 transition-colors">Just Exploring</h3>
                  <p className="text-gray-600 text-xs md:text-sm mt-0.5 md:mt-1">Skip the tutorial and jump straight into the dashboard.</p>
                </div>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
              </button>

            </div>
          </div>
        </div>
      </div>
    </>
  )
}
