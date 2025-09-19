'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface TutorialStep {
  id: string
  title: string
  description: string
  targetSelector?: string
  position: 'top' | 'bottom' | 'left' | 'right' | 'center'
  action?: () => void
  triggerNext?: () => boolean
}

interface OnboardingTutorialProps {
  onCompleteAction: () => void
  onSkipAction: () => void
}

export default function OnboardingTutorial({ onCompleteAction, onSkipAction }: OnboardingTutorialProps) {
  const [currentStep, setCurrentStep] = useState(() => {
    // Initialize from localStorage or start at 0
    if (typeof window !== 'undefined') {
      const savedStep = localStorage.getItem('onboarding-tutorial-step')
      return savedStep ? parseInt(savedStep, 10) : 0
    }
    return 0
  })
  const [isVisible, setIsVisible] = useState(true)
  const [showActionNeeded, setShowActionNeeded] = useState(false)
  const supabase = createClient()

  // Save current step to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('onboarding-tutorial-step', currentStep.toString())
    }
  }, [currentStep])

  const tutorialSteps: TutorialStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Image2Ad! 🎉',
      description: 'Let\'s get you started with creating your first professional ad. This quick tutorial will show you the simple steps.',
      position: 'center'
    },
    {
      id: 'enter-folder-name',
      title: 'Step 1: Enter Folder Name',
      description: 'Type a name for your first folder in the input field above (try "My First Project" or any name you like).',
      targetSelector: 'input[placeholder*="folder name"]',
      position: 'bottom',
      triggerNext: () => {
        const input = document.querySelector('input[placeholder*="folder name"]') as HTMLInputElement;
        return input && input.value.trim().length > 0;
      }
    },
    {
      id: 'create-folder',
      title: 'Step 2: Create Your Folder',
      description: 'Perfect! Now click "Create Folder" and we\'ll automatically open your new folder so you can start uploading images right away.',
      targetSelector: '[data-tutorial="create-button"]',
      position: 'bottom',
      triggerNext: () => {
        const folderElements = document.querySelectorAll('[data-folder-id]');
        return folderElements.length > 0;
      }
    },
    {
      id: 'upload-images',
      title: 'Step 3: Upload Your Images',
      description: 'Excellent! Your folder is now open and ready. Drag and drop your product images or click to browse. You can upload JPG, PNG, or WEBP files up to 20MB each.',
      targetSelector: '[data-tutorial="upload-area"]',
      position: 'top'
    },
    {
      id: 'select-images',
      title: 'Step 4: Select Images for Your Ad',
      description: 'Click on images to select them. You can try our new multi-image beta feature with the toggle above!',
      targetSelector: '[data-tutorial="image-grid"]',
      position: 'top'
    },
    {
      id: 'generate-ad',
      title: 'Step 5: Generate Your Ad',
      description: 'Click "Generate Ad" to create professional marketing content from your images. Give your ad a name and describe what you want!',
      targetSelector: '[data-tutorial="generate-button"]',
      position: 'top'
    },
    {
      id: 'complete',
      title: 'You\'re All Set! 🚀',
      description: 'You now know how to create folders, upload images, and generate ads. Start creating amazing marketing content!',
      position: 'center'
    }
  ]

  const currentStepData = tutorialSteps[currentStep]

  const handleNext = () => {
    // Check if current step has a trigger condition
    if (currentStepData.triggerNext && !currentStepData.triggerNext()) {
      // Show a message that they need to complete the action first
      setShowActionNeeded(true)
      setTimeout(() => setShowActionNeeded(false), 3000) // Hide after 3 seconds
      return
    }

    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1)
      setShowActionNeeded(false)
    } else {
      handleComplete()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = async () => {
    try {
      // Mark tutorial as completed in database
      const { error } = await supabase
        .from('profiles')
        .update({ tutorial_completed: true })
        .eq('id', (await supabase.auth.getUser()).data.user?.id)

      if (error) {
        console.error('Error marking tutorial as completed:', error)
      }
    } catch (error) {
      console.error('Error completing tutorial:', error)
    }

    // Clear tutorial progress from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('onboarding-tutorial-step')
    }

    setIsVisible(false)
    onCompleteAction()
  }

  const handleSkip = async () => {
    await handleComplete() // Mark as completed even if skipped
    onSkipAction()
  }

  const getTooltipPosition = (target: Element | null) => {
    if (!target) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }

    const rect = target.getBoundingClientRect()
    const tooltipWidth = 320
    const tooltipHeight = 200

    switch (currentStepData.position) {
      case 'top':
        return {
          top: `${rect.top - tooltipHeight - 20}px`,
          left: `${rect.left + (rect.width / 2) - (tooltipWidth / 2)}px`
        }
      case 'bottom':
        return {
          top: `${rect.bottom + 20}px`,
          left: `${rect.left + (rect.width / 2) - (tooltipWidth / 2)}px`
        }
      case 'left':
        return {
          top: `${rect.top + (rect.height / 2) - (tooltipHeight / 2)}px`,
          left: `${rect.left - tooltipWidth - 20}px`
        }
      case 'right':
        return {
          top: `${rect.top + (rect.height / 2) - (tooltipHeight / 2)}px`,
          left: `${rect.right + 20}px`
        }
      default: // center
        return {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        }
    }
  }

  const [tooltipPosition, setTooltipPosition] = useState<any>({})

  useEffect(() => {
    if (currentStepData.targetSelector) {
      const target = document.querySelector(currentStepData.targetSelector)
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setTooltipPosition(getTooltipPosition(target))
      }
    } else {
      setTooltipPosition({
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      })
    }
  }, [currentStep])

  if (!isVisible) return null

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-50 pointer-events-auto">
        {/* Highlight target element */}
        {currentStepData.targetSelector && (
          <style jsx global>{`
            ${currentStepData.targetSelector} {
              position: relative !important;
              z-index: 51 !important;
              box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 0 8px rgba(59, 130, 246, 0.2) !important;
              border-radius: 8px !important;
            }
          `}</style>
        )}

        {/* Tutorial Tooltip */}
        <div
          className="absolute bg-white rounded-xl shadow-2xl border border-gray-200 p-6 max-w-sm z-52"
          style={tooltipPosition}
        >
          {/* Progress */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex space-x-1">
              {tutorialSteps.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full ${
                    index <= currentStep ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={handleSkip}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              Skip tutorial
            </button>
          </div>

          {/* Content */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {currentStepData.title}
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              {currentStepData.description}
            </p>
            {showActionNeeded && currentStepData.triggerNext && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  👆 Please complete this step first before continuing!
                </p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                currentStep === 0
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Previous
            </button>

            <span className="text-xs text-gray-500">
              {currentStep + 1} of {tutorialSteps.length}
            </span>

            <button
              onClick={handleNext}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              {currentStep === tutorialSteps.length - 1 ? 'Get Started!' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}