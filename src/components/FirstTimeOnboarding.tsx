'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import confetti from 'canvas-confetti'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/validations'

interface FirstTimeOnboardingProps {
  user: User
  profile: Profile
  onCompleteAction: (prefillPrompt: string) => void
}

export default function FirstTimeOnboarding({ user, profile, onCompleteAction }: FirstTimeOnboardingProps) {
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)
  const [hasShownConfetti, setHasShownConfetti] = useState(false)
  const supabase = createClient()

  // The demo prompt that will be pre-filled
  const DEMO_PROMPT = "A cozy French café scene with a white ceramic coffee cup on a wooden table. The cup has 'Made by You' written in elegant handwriting, surrounded by soft daylight, warm tones, and perfect latte art in the foam."

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

  const handleLetsGo = () => {
    setShowWelcomeModal(false)
    // Pass the demo prompt to prefill the input
    onCompleteAction(DEMO_PROMPT)
  }

  if (!showWelcomeModal) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] animate-in fade-in duration-300" />
      
      {/* Welcome Modal */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-300">
          {/* Header with emoji and confetti background */}
          <div className="bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-8 rounded-t-2xl text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
            <div className="relative z-10">
              <div className="text-6xl mb-4 animate-bounce">☕</div>
              <h2 className="text-3xl font-bold text-white mb-2">
                Welcome to Image2Ad!
              </h2>
              <p className="text-white/90 text-lg">
                Let's generate your first ad together — it only takes a few seconds.
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="p-8">
            <div className="space-y-4 mb-6">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold">1</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Click "Generate"</h3>
                  <p className="text-sm text-gray-600">We'll highlight it for you</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 font-semibold">2</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Watch the magic</h3>
                  <p className="text-sm text-gray-600">AI creates a beautiful ad in seconds</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center">
                  <span className="text-pink-600 font-semibold">3</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Try your own</h3>
                  <p className="text-sm text-gray-600">You get 3 free images to start!</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleLetsGo}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transform hover:scale-[1.02]"
            >
              Let's Go! 🚀
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
