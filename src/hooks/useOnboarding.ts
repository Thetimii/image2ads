'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/validations'

export function useOnboarding(user: User, profile: Profile) {
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(false)
  const [isSkipped, setIsSkipped] = useState(false)
  // Simplified: Just highlight the send button if tutorial not completed AND not skipped locally
  const shouldHighlightGenerate = !profile.tutorial_completed && !isSkipped
  const [shouldShowUpgrade, setShouldShowUpgrade] = useState(false)
  const [prefillPrompt, setPrefillPrompt] = useState<string>('')
  const supabase = createClient()

  useEffect(() => {
    // Show onboarding if tutorial not completed
    if (!profile.tutorial_completed) {
      setShouldShowOnboarding(true)
    }
  }, [profile.tutorial_completed])

  // Tutorial mode state
  const [tutorialMode, setTutorialMode] = useState<'product' | 'artist' | null>(null)

  const handleOnboardingComplete = useCallback((prompt: string, mode: 'product' | 'artist' = 'artist') => {
    console.log(`Onboarding complete, mode: ${mode}, prefilling prompt`)
    setShouldShowOnboarding(false)
    setPrefillPrompt(prompt)
    setTutorialMode(mode)
  }, [])

  const handleSkipOnboarding = useCallback(async () => {
    console.log('Skipping onboarding')
    setShouldShowOnboarding(false)
    setTutorialMode(null)
    setIsSkipped(true)

    // Mark tutorial as completed immediately
    await supabase
      .from('profiles')
      .update({ tutorial_completed: true })
      .eq('id', user.id)
  }, [user.id, supabase])

  const handleFirstGeneration = useCallback(async () => {
    console.log('First generation triggered, marking tutorial as complete')
    setPrefillPrompt('') // Clear the prefilled prompt so it doesn't refill
    setTutorialMode(null)

    // Mark tutorial as completed
    await supabase
      .from('profiles')
      .update({ tutorial_completed: true })
      .eq('id', user.id)
  }, [user.id, supabase])

  const checkCreditsAndShowUpgrade = useCallback(() => {
    // Show upgrade prompt if:
    // 1. User has no credits left
    // 2. User is not a paying customer (no stripe_customer_id)
    if (profile.credits === 0 && !profile.stripe_customer_id) {
      console.log('Free images exhausted, showing upgrade prompt')
      setShouldShowUpgrade(true)
      return true
    }
    return false
  }, [profile.credits, profile.stripe_customer_id])

  const closeUpgradePrompt = useCallback(() => {
    setShouldShowUpgrade(false)
  }, [])

  const isNavigationLocked = !profile.tutorial_completed

  return {
    shouldShowOnboarding,
    shouldHighlightGenerate,
    shouldShowUpgrade,
    prefillPrompt,
    handleOnboardingComplete,
    handleSkipOnboarding,
    handleFirstGeneration,
    checkCreditsAndShowUpgrade,
    closeUpgradePrompt,
    isNavigationLocked,
    tutorialMode
  }
}
