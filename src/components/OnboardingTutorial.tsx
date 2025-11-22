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
  const [currentStep, setCurrentStep] = useState(0)
  const [isVisible, setIsVisible] = useState(true)
  const supabase = createClient()

  const tutorialSteps: TutorialStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Image2Ad! 🎉',
      description: 'Let\'s get you started with creating your first professional ad. This quick tutorial will show you the 3 simple steps.',
      position: 'center'
    },
    {
      id: 'create-folder',
      title: 'Step 1: Create Your First Folder',
      description: 'Folders help you organize your projects. Click the "Create" button to make your first folder.',
      targetSelector: '[data-tutorial="create-button"]',
      position: 'bottom'
    },
    {
      id: 'upload-images',
      title: 'Step 2: Upload Your Images',
      description: 'Drag and drop your product images here, or click to browse. You can upload JPG, PNG, or WEBP files up to 20MB each.',
      targetSelector: '[data-tutorial="upload-area"]',
      position: 'top'
    },
    {
      id: 'select-images',
      title: 'Step 3: Select Images for Your Ad',
      description: 'Click on images to select them. You can try our new multi-image beta feature with the toggle above!',
      targetSelector: '[data-tutorial="image-grid"]',
      position: 'top'
    },
    {
      id: 'generate-ad',
      title: 'Step 4: Generate Your Ad',
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
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1)
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

    setIsVisible(false)
    onCompleteAction()
  }

  const handleSkip = async () => {
    await handleComplete() // Mark as completed even if skipped
    onSkipAction()
  }

  const getTooltipPosition = (target: Element | null) => {
    const fallbackWidth = typeof window !== 'undefined' ? Math.min(360, window.innerWidth - 24) : 320

    if (!target) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: `${fallbackWidth}px` }

    const rect = target.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const padding = viewportWidth < 640 ? 12 : 20
    const tooltipWidth = Math.min(360, viewportWidth - padding * 2)
    const tooltipHeight = Math.min(240, viewportHeight - padding * 2)

    switch (currentStepData.position) {
      case 'top':
        return {
          top: `${Math.max(padding, rect.top - tooltipHeight - padding)}px`,
          left: `${Math.max(padding, Math.min(viewportWidth - tooltipWidth - padding, rect.left + (rect.width / 2) - (tooltipWidth / 2)))}px`,
          width: `${tooltipWidth}px`
        }
      case 'bottom':
        return {
          top: `${Math.min(viewportHeight - tooltipHeight - padding, rect.bottom + padding)}px`,
          left: `${Math.max(padding, Math.min(viewportWidth - tooltipWidth - padding, rect.left + (rect.width / 2) - (tooltipWidth / 2)))}px`,
          width: `${tooltipWidth}px`
        }
      case 'left':
        return {
          top: `${Math.max(padding, Math.min(viewportHeight - tooltipHeight - padding, rect.top + (rect.height / 2) - (tooltipHeight / 2)))}px`,
          left: `${Math.max(padding, rect.left - tooltipWidth - padding)}px`,
          width: `${tooltipWidth}px`
        }
      case 'right':
        return {
          top: `${Math.max(padding, Math.min(viewportHeight - tooltipHeight - padding, rect.top + (rect.height / 2) - (tooltipHeight / 2)))}px`,
          left: `${Math.min(viewportWidth - tooltipWidth - padding, rect.right + padding)}px`,
          width: `${tooltipWidth}px`
        }
      default: // center
        return {
          top: '50%',
          left: '50%',
          width: `${tooltipWidth}px`,
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
      setTooltipPosition(getTooltipPosition(null))
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
          className="absolute bg-white rounded-xl shadow-2xl border border-gray-200 p-4 sm:p-6 max-w-[calc(100vw-32px)] w-[min(360px,calc(100vw-32px))] max-h-[calc(100vh-32px)] overflow-y-auto z-52"
          style={{ ...tooltipPosition, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 32px)' }}
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
