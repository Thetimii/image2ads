'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTutorial } from '@/contexts/TutorialContext'

export default function TutorialOverlay() {
  const {
    isActive,
    currentStepData,
    currentStep,
    steps,
    nextStep,
    previousStep,
    skipTutorial
  } = useTutorial()

  const [tooltipPosition, setTooltipPosition] = useState<any>({
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    transition: 'all 0.3s ease-in-out',
    side: 'center'
  })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    // Inject CSS for highlighting
    const style = document.createElement('style')
    style.id = 'tutorial-styles'
    style.textContent = `
      .tutorial-highlight {
        position: relative !important;
        z-index: 9998 !important;
        box-shadow: 
          0 0 0 3px rgba(59, 130, 246, 0.4),
          0 0 0 6px rgba(59, 130, 246, 0.2),
          0 0 20px 2px rgba(59, 130, 246, 0.3) !important;
        border-radius: 12px !important;
        animation: tutorial-glow 2s ease-in-out infinite;
        pointer-events: auto !important;
        transition: all 0.3s ease-in-out !important;
      }
      
      .tutorial-force-enabled {
        background: linear-gradient(135deg, #3b82f6, #8b5cf6) !important;
        color: white !important;
        opacity: 1 !important;
        cursor: pointer !important;
        pointer-events: auto !important;
        border-color: transparent !important;
      }
      
      @keyframes tutorial-glow {
        0%, 100% { 
          box-shadow: 
            0 0 0 3px rgba(59, 130, 246, 0.4),
            0 0 0 6px rgba(59, 130, 246, 0.2),
            0 0 20px 2px rgba(59, 130, 246, 0.3);
          transform: scale(1);
        }
        50% { 
          box-shadow: 
            0 0 0 5px rgba(59, 130, 246, 0.6),
            0 0 0 10px rgba(59, 130, 246, 0.3),
            0 0 30px 4px rgba(59, 130, 246, 0.4);
          transform: scale(1.01);
        }
      }
      
      .tutorial-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
        pointer-events: none;
        backdrop-filter: blur(2px);
        transition: all 0.3s ease-in-out;
      }
      
      .tutorial-tooltip {
        pointer-events: auto;
        z-index: 10000;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        animation: tooltipSlideIn 0.4s ease-out;
      }
      
      .tutorial-tooltip::before {
        content: '';
        position: absolute;
        width: 0;
        height: 0;
        border: 12px solid transparent;
        pointer-events: none;
      }
      
      /* Arrow positioning based on tooltip position */
      .tutorial-tooltip[data-position="bottom"]::before {
        top: -24px;
        left: 50%;
        transform: translateX(-50%);
        border-bottom-color: white;
        border-top: none;
        filter: drop-shadow(0 -2px 4px rgba(0,0,0,0.1));
      }
      
      .tutorial-tooltip[data-position="top"]::before {
        bottom: -24px;
        left: 50%;
        transform: translateX(-50%);
        border-top-color: white;
        border-bottom: none;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
      }
      
      .tutorial-tooltip[data-position="right"]::before {
        left: -24px;
        top: 50%;
        transform: translateY(-50%);
        border-right-color: white;
        border-left: none;
        filter: drop-shadow(-2px 0 4px rgba(0,0,0,0.1));
      }
      
      .tutorial-tooltip[data-position="left"]::before {
        right: -24px;
        top: 50%;
        transform: translateY(-50%);
        border-left-color: white;
        border-right: none;
        filter: drop-shadow(2px 0 4px rgba(0,0,0,0.1));
      }
      
      .tutorial-tooltip[data-position="center"]::before {
        display: none;
      }
      
      @keyframes tooltipSlideIn {
        0% {
          opacity: 0;
          transform: translateY(-10px) scale(0.95);
        }
        100% {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
    `

    // Remove existing style if it exists
    const existingStyle = document.getElementById('tutorial-styles')
    if (existingStyle) {
      existingStyle.remove()
    }

    document.head.appendChild(style)

    return () => {
      // Clean up
      const styleEl = document.getElementById('tutorial-styles')
      if (styleEl) {
        styleEl.remove()
      }
      // Clean up any highlighted elements
      document.querySelectorAll('.tutorial-highlight').forEach(el => {
        el.classList.remove('tutorial-highlight')
      })
    }
  }, [])

  const getTooltipPosition = (target: Element | null) => {
    if (!target) {
      return {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1000
      }
    }

    const rect = target.getBoundingClientRect()
    const tooltipWidth = 400
    const tooltipHeight = 250
    const padding = 20
    const arrowSize = 12

    console.log('Dynamic positioning for:', currentStepData?.id, { rect, viewport: { width: window.innerWidth, height: window.innerHeight } })

    // Calculate available space in each direction
    const spaceAbove = rect.top
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceLeft = rect.left
    const spaceRight = window.innerWidth - rect.right

    // Determine best position based on available space and step type
    let position = 'center'
    let top = 0
    let left = 0
    let transform = ''

    // Smart positioning logic
    if (spaceBelow >= tooltipHeight + padding) {
      // Prefer bottom if there's space
      position = 'bottom'
      top = rect.bottom + padding
      left = Math.max(padding, Math.min(window.innerWidth - tooltipWidth - padding, rect.left + (rect.width / 2) - (tooltipWidth / 2)))
    } else if (spaceAbove >= tooltipHeight + padding) {
      // Then top if bottom doesn't fit
      position = 'top'
      top = rect.top - tooltipHeight - padding
      left = Math.max(padding, Math.min(window.innerWidth - tooltipWidth - padding, rect.left + (rect.width / 2) - (tooltipWidth / 2)))
    } else if (spaceRight >= tooltipWidth + padding) {
      // Then right side
      position = 'right'
      top = Math.max(padding, Math.min(window.innerHeight - tooltipHeight - padding, rect.top + (rect.height / 2) - (tooltipHeight / 2)))
      left = rect.right + padding
    } else if (spaceLeft >= tooltipWidth + padding) {
      // Then left side
      position = 'left'
      top = Math.max(padding, Math.min(window.innerHeight - tooltipHeight - padding, rect.top + (rect.height / 2) - (tooltipHeight / 2)))
      left = rect.left - tooltipWidth - padding
    } else {
      // Fallback to center if nothing fits
      position = 'center'
      top = window.innerHeight / 2
      left = window.innerWidth / 2
      transform = 'translate(-50%, -50%)'
    }

    console.log('Positioned tooltip:', { position, top, left, transform })

    return {
      position: 'fixed' as const,
      top: `${top}px`,
      left: `${left}px`,
      transform,
      zIndex: 10000,
      transition: 'all 0.3s ease-in-out', // Smooth transitions
      '--tooltip-position': position, // CSS custom property for arrow positioning
      side: position // Add side for data-position attribute
    } as React.CSSProperties & { side: string }
  }

  useEffect(() => {
    if (!isActive || !currentStepData || !mounted) return

    const updatePosition = () => {
      if (currentStepData.targetSelector) {
        const target = document.querySelector(currentStepData.targetSelector)
        console.log('Tutorial positioning update:', {
          selector: currentStepData.targetSelector,
          target: !!target,
          step: currentStepData.id
        })

        if (target) {
          // Remove previous highlighting from all elements
          document.querySelectorAll('.tutorial-highlight, .tutorial-force-enabled').forEach(el => {
            el.classList.remove('tutorial-highlight', 'tutorial-force-enabled')
          })

          // Check if element is in viewport
          const rect = target.getBoundingClientRect()
          const isInViewport = rect.top >= 0 && rect.bottom <= window.innerHeight &&
            rect.left >= 0 && rect.right <= window.innerWidth

          if (!isInViewport) {
            console.log('Scrolling target into view:', currentStepData.id)
            target.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'center'
            })
          }

          // Add highlighting and positioning after a smooth delay
          setTimeout(() => {
            target.classList.add('tutorial-highlight')

            // Handle disabled elements for tutorial
            // Check both attribute and property since React may set either
            const isDisabled = target.hasAttribute('disabled') || (target as HTMLButtonElement).disabled

            console.log('[TutorialOverlay] Button state:', {
              stepId: currentStepData.id,
              hasDisabledAttr: target.hasAttribute('disabled'),
              disabledProp: (target as HTMLButtonElement).disabled,
              isDisabled,
              classList: target.classList.toString()
            })

            if (isDisabled && currentStepData.id === 'generate-ad') {
              console.log('[TutorialOverlay] Temporarily enabling disabled button for tutorial')
              target.removeAttribute('disabled');
              (target as HTMLButtonElement).disabled = false
              target.classList.add('tutorial-force-enabled')
            }

            // Update tooltip position with latest rect
            const updatedRect = target.getBoundingClientRect()
            setTooltipPosition(getTooltipPosition(target))
          }, isInViewport ? 100 : 800) // Longer delay if we had to scroll
        } else {
          console.warn('Tutorial target not found:', currentStepData.targetSelector)
          setTooltipPosition(getTooltipPosition(null))
        }
      } else {
        // No target, center the tooltip
        setTooltipPosition(getTooltipPosition(null))
      }
    }

    // Initial position
    setTimeout(updatePosition, 100)

    // Update position on resize and scroll
    const handleResize = () => updatePosition()
    const handleScroll = () => updatePosition()

    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleScroll)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [currentStepData, isActive, mounted])

  // Auto-advance for certain steps
  useEffect(() => {
    if (currentStepData?.autoAdvance) {
      const timer = setTimeout(() => {
        nextStep()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [currentStepData, nextStep])

  if (!isActive || !currentStepData || !mounted) return null

  const overlayContent = (
    <div className="hidden md:block">
      {/* Dark overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        style={{ backdropFilter: 'blur(2px)' }}
      />

      {/* Highlight target element */}
      {currentStepData.targetSelector && (
        <style jsx global>{`
          ${currentStepData.targetSelector} {
            position: relative !important;
            z-index: 999 !important;
            box-shadow: 
              0 0 0 4px rgba(59, 130, 246, 0.8),
              0 0 0 8px rgba(59, 130, 246, 0.3),
              0 0 20px rgba(59, 130, 246, 0.5) !important;
            border-radius: 8px !important;
            background-color: white !important;
          }
          
          ${currentStepData.targetSelector}:before {
            content: '';
            position: absolute;
            top: -8px;
            left: -8px;
            right: -8px;
            bottom: -8px;
            border-radius: 12px;
            background: linear-gradient(45deg, #3b82f6, #8b5cf6);
            z-index: -1;
            animation: pulse 2s infinite;
          }
          
          @keyframes pulse {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 0.8; }
          }
        `}</style>
      )}

      {/* Tutorial tooltip */}
      <div
        className="tutorial-tooltip bg-white rounded-xl shadow-2xl border border-gray-200 p-6 max-w-sm z-50"
        data-position={tooltipPosition.side}
        style={tooltipPosition}
      >
        {/* Progress bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex space-x-1">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${index <= currentStep ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
              />
            ))}
          </div>
          <button
            onClick={skipTutorial}
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

          {currentStepData.waitForAction && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-700 font-medium">
                {currentStepData.waitForAction === 'input' && '✏️ Type something to continue'}
                {currentStepData.waitForAction === 'click' && '👆 Click the highlighted element'}
                {currentStepData.waitForAction === 'upload' && '📁 Upload an image to continue'}
                {currentStepData.waitForAction === 'select' && '✅ Select an image to continue'}
                {currentStepData.waitForAction === 'navigation' && '🧭 Navigation in progress...'}
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={previousStep}
            disabled={currentStep === 0}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${currentStep === 0
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
          >
            Previous
          </button>

          <span className="text-xs text-gray-500">
            {currentStep + 1} of {steps.length}
          </span>

          {!currentStepData.waitForAction && (
            <button
              onClick={nextStep}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              {currentStep === steps.length - 1 ? 'Finish!' : 'Next'}
            </button>
          )}

          {currentStepData.waitForAction && (
            <div className="w-16"></div> // Spacer to maintain layout
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(overlayContent, document.body)
}