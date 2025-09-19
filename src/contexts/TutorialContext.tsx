'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Hook to detect mobile devices
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768) // md breakpoint
    }
    
    checkIsMobile()
    window.addEventListener('resize', checkIsMobile)
    
    return () => window.removeEventListener('resize', checkIsMobile)
  }, [])
  
  return isMobile
}

interface TutorialProviderProps {
  children: React.ReactNode
  userTutorialCompleted?: boolean
}

export interface TutorialStep {
  id: string
  page: 'dashboard' | 'folder'
  title: string
  description: string
  targetSelector?: string
  position: 'top' | 'bottom' | 'left' | 'right' | 'center'
  waitForAction?: 'input' | 'click' | 'navigation' | 'upload' | 'select'
  actionTarget?: string
  autoAdvance?: boolean
  customContent?: ReactNode
}

interface TutorialContextType {
  isActive: boolean
  currentStep: number
  currentStepData: TutorialStep | null
  steps: TutorialStep[]
  startTutorial: () => void
  nextStep: () => void
  previousStep: () => void
  skipTutorial: () => void
  completeTutorial: () => void
  checkStepTrigger: (action: string, target?: string) => void
  setTutorialFolderId: (id: string) => void
  tutorialFolderId: string | null
}

const TutorialContext = createContext<TutorialContextType | null>(null)

export function useTutorial() {
  const context = useContext(TutorialContext)
  if (!context) {
    throw new Error('useTutorial must be used within a TutorialProvider')
  }
  return context
}



export function TutorialProvider({ children, userTutorialCompleted = false }: TutorialProviderProps) {
  const [isActive, setIsActive] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [tutorialFolderId, setTutorialFolderId] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const isMobile = useIsMobile()

  const steps: TutorialStep[] = [
    {
      id: 'welcome',
      page: 'dashboard',
      title: 'Welcome to Image2Ad! 🎉',
      description: 'Let\'s create your first professional ad in just 4 simple steps. This tutorial will guide you through the entire process.',
      position: 'center'
    },
    {
      id: 'name-folder',
      page: 'dashboard',
      title: 'Step 1: Name Your Folder',
      description: 'First, give your folder a name like "My First Project" or "Product Photos". This helps organize your images.',
      targetSelector: '[data-tutorial="folder-name-input"]',
      position: 'bottom',
      waitForAction: 'input',
      actionTarget: '[data-tutorial="folder-name-input"]'
    },
    {
      id: 'create-folder',
      page: 'dashboard',
      title: 'Step 2: Create the Folder',
      description: 'Perfect! Now click "Create Folder" to make your first project folder.',
      targetSelector: '[data-tutorial="create-button"]',
      position: 'bottom',
      waitForAction: 'click',
      actionTarget: '[data-tutorial="create-button"]'
    },
    {
      id: 'folder-created',
      page: 'folder',
      title: 'Great! Now Let\'s Add Images',
      description: 'You\'ve created your folder! Now we\'ll upload some images to start creating ads.',
      position: 'center',
      autoAdvance: true
    },
    {
      id: 'upload-images',
      page: 'folder',
      title: 'Step 3: Upload Your Images',
      description: 'Upload your product or marketing images here. You can drag & drop files or click to browse. JPG, PNG, and WEBP files up to 20MB are supported. The tutorial will continue once your upload completes.',
      targetSelector: '[data-tutorial="upload-area"]',
      position: 'top',
      waitForAction: 'upload'
    },
    {
      id: 'select-image',
      page: 'folder',
      title: 'Step 4: Select an Image',
      description: 'Excellent! Your images are uploaded. Now click on one of your uploaded images to select it for ad generation.',
      targetSelector: '[data-tutorial="image-grid"]',
      position: 'top',
      waitForAction: 'select'
    },
    {
      id: 'generate-ad',
      page: 'folder',
      title: 'Step 5: Open Generate Form',
      description: 'Perfect! Now click "Generate Ad" to open the form where you\'ll describe your advertisement.',
      targetSelector: '[data-tutorial="generate-button"]',
      position: 'top',
      waitForAction: 'click',
      actionTarget: '[data-tutorial="generate-button"]'
    },
    {
      id: 'fill-ad-name',
      page: 'folder',
      title: 'Step 6: Name Your Ad',
      description: 'Give your ad a descriptive name like "Coffee Mug Advertisement" or "Product Launch Campaign".',
      targetSelector: '[data-tutorial="ad-name-input"]',
      position: 'bottom',
      waitForAction: 'input',
      actionTarget: '[data-tutorial="ad-name-input"]'
    },
    {
      id: 'fill-prompt',
      page: 'folder',
      title: 'Step 7: Describe Your Ad',
      description: 'Describe what kind of advertisement you want to create. For example: "Create a professional product advertisement with clean background".',
      targetSelector: '[data-tutorial="prompt-input"]',
      position: 'bottom',
      waitForAction: 'input',
      actionTarget: '[data-tutorial="prompt-input"]'
    },
    {
      id: 'generate-final',
      page: 'folder',
      title: 'Step 8: Generate Your Ad',
      description: 'Everything looks good! Now click "Generate Ad" to create your professional advertisement.',
      targetSelector: '[data-tutorial="generate-final-button"]',
      position: 'top',
      waitForAction: 'click',
      actionTarget: '[data-tutorial="generate-final-button"]'
    },
    {
      id: 'view-results',
      page: 'folder',
      title: 'Step 9: Your Ad is Being Created! 🎨',
      description: 'Your ad is now being generated! It will appear in the "Generated Ads" section below in about 10-15 seconds.',
      targetSelector: '[data-tutorial="generated-ads-section"]',
      position: 'top',
      autoAdvance: true
    },
    {
      id: 'complete',
      page: 'folder',
      title: 'Congratulations! 🎉',
      description: 'You\'ve successfully started generating your first ad! Your ad will appear in the folder when it\'s ready. You can now create more folders, upload more images, and generate unlimited professional ads.',
      position: 'center'
    }
  ]

  const currentStepData = steps[currentStep] || null

  // Load tutorial state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('image2ad-tutorial-state')
    if (savedState) {
      try {
        const { step, folderId, active } = JSON.parse(savedState)
        console.log('Loading saved tutorial state:', { step, folderId, active })
        if (active) {
          setCurrentStep(step)
          setTutorialFolderId(folderId)
          setIsActive(true)
        }
      } catch (error) {
        console.error('Error loading tutorial state:', error)
      }
    }
    // Note: Don't auto-start tutorial here, let components decide based on user data
  }, [])

  // Handle auto-advance steps
  useEffect(() => {
    if (isActive && currentStepData?.autoAdvance) {
      console.log('Auto-advancing step:', currentStepData.id)
      // Different timing for different steps
      const delay = currentStepData.id === 'view-results' ? 4000 : 2000 // 4 seconds for view-results, 2 seconds for others
      const timer = setTimeout(() => {
        nextStep()
      }, delay)
      
      return () => clearTimeout(timer)
    }
  }, [currentStep, isActive, currentStepData])

  // Save tutorial state to localStorage
  useEffect(() => {
    if (isActive) {
      localStorage.setItem('image2ad-tutorial-state', JSON.stringify({
        step: currentStep,
        folderId: tutorialFolderId,
        active: isActive
      }))
    }
  }, [currentStep, tutorialFolderId, isActive])

  const startTutorial = () => {
    // Don't start tutorial on mobile devices
    if (isMobile) {
      console.log('Tutorial disabled on mobile devices')
      return
    }
    
    console.log('Starting tutorial...')
    setIsActive(true)
    setCurrentStep(0)
    setTutorialFolderId(null)
  }

  const nextStep = () => {
    console.log('Next step called. Current step:', currentStep, 'Total steps:', steps.length)
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
      console.log('Advanced to step:', currentStep + 1)
    } else {
      console.log('Reached final step, completing tutorial')
      completeTutorial()
    }
  }

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const skipTutorial = async () => {
    console.log('Skipping tutorial...')
    await completeTutorial()
  }

  const completeTutorial = async () => {
    console.log('Completing tutorial...')
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError) {
        console.error('Error getting user:', userError)
        return
      }
      
      if (!user) {
        console.error('No user found when trying to complete tutorial')
        return
      }

      console.log('Updating tutorial_completed for user:', user.id)

      // Mark tutorial as completed in database
      const { error } = await supabase
        .from('profiles')
        .update({ tutorial_completed: true })
        .eq('id', user.id)

      if (error) {
        console.error('Error marking tutorial as completed:', error)
      } else {
        console.log('Tutorial marked as completed successfully')
      }
    } catch (error) {
      console.error('Error completing tutorial:', error)
    }

    // Clear tutorial state regardless of database success
    setIsActive(false)
    localStorage.removeItem('image2ad-tutorial-state')
    console.log('Tutorial state cleared')
  }

  const checkStepTrigger = (action: string, target?: string) => {
    if (!isActive || !currentStepData?.waitForAction) return

    console.log('Tutorial trigger check:', { action, target, waitForAction: currentStepData.waitForAction, actionTarget: currentStepData.actionTarget })

    // Special case: 'modal-opened' action should advance 'generate-ad' step
    let isCorrectAction = action === currentStepData.waitForAction
    if (currentStepData.id === 'generate-ad' && action === 'modal-opened') {
      isCorrectAction = true
    }
    // Special case: 'generation-started' action should advance 'generate-final' step
    if (currentStepData.id === 'generate-final' && action === 'generation-started') {
      isCorrectAction = true
    }
    
    // More flexible target matching
    let isCorrectTarget = true
    if (currentStepData.actionTarget && target) {
      // Try exact match first
      isCorrectTarget = target === currentStepData.actionTarget
      
      // If not exact match, try to find if target matches the selector
      if (!isCorrectTarget) {
        const targetElement = document.querySelector(target.startsWith('[') ? target : `[data-tutorial="${target}"]`)
        const expectedElement = document.querySelector(currentStepData.actionTarget)
        isCorrectTarget = targetElement === expectedElement
      }
    }

    // For modal-opened and generation-started, we don't need target checking
    if (action === 'modal-opened' || action === 'generation-started') {
      isCorrectTarget = true
    }

    console.log('Tutorial check result:', { isCorrectAction, isCorrectTarget })

    if (isCorrectAction && isCorrectTarget) {
      setTimeout(() => {
        nextStep()
        
        // Auto-scroll to results section when advancing to view-results step
        if (currentStepData.id === 'generate-final') {
          setTimeout(() => {
            const resultsSection = document.querySelector('[data-tutorial="generated-ads-section"]')
            if (resultsSection) {
              resultsSection.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
          }, 100) // Small delay to ensure tutorial overlay is updated
        }
      }, action === 'navigation' ? 1000 : 500) // Delay for navigation
    }
  }

  // Handle page navigation during tutorial
  useEffect(() => {
    if (isActive && currentStepData) {
      const expectedPage = currentStepData.page
      const currentPage = pathname.startsWith('/folders/') ? 'folder' : 'dashboard'
      
      // If we're on the wrong page, redirect or advance step
      if (expectedPage === 'folder' && currentPage === 'dashboard' && tutorialFolderId) {
        // Navigate to folder page
        router.push(`/folders/${tutorialFolderId}`)
      }
    }
  }, [pathname, currentStepData, isActive, tutorialFolderId, router])

  return (
    <TutorialContext.Provider value={{
      isActive: isActive && !isMobile, // Disable tutorial on mobile
      currentStep,
      currentStepData,
      steps,
      startTutorial,
      nextStep,
      previousStep,
      skipTutorial,
      completeTutorial,
      checkStepTrigger,
      setTutorialFolderId,
      tutorialFolderId
    }}>
      {children}
    </TutorialContext.Provider>
  )
}