'use client'

import { useEffect, useState } from 'react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  color?: 'blue' | 'purple' | 'white' | 'gray'
  className?: string
}

export default function LoadingSpinner({ 
  size = 'md', 
  color = 'blue', 
  className = '' 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  }

  const colorClasses = {
    blue: 'border-blue-600',
    purple: 'border-purple-600',
    white: 'border-white',
    gray: 'border-gray-600'
  }

  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <div 
        className={`w-full h-full border-2 border-transparent border-t-current ${colorClasses[color]} rounded-full animate-spin`}
        style={{ 
          borderTopColor: 'currentColor',
          borderRightColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: 'transparent'
        }}
      />
    </div>
  )
}

interface SmoothLoadingProps {
  message?: string
  submessage?: string
  progress?: number
  showProgress?: boolean
  className?: string
}

export function SmoothLoading({ 
  message = 'Loading...', 
  submessage,
  progress,
  showProgress = false,
  className = '' 
}: SmoothLoadingProps) {
  const [dots, setDots] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return ''
        return prev + '.'
      })
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
      {/* Main spinner */}
      <div className="relative mb-6">
        <div className="w-16 h-16 border-4 border-gray-200 rounded-full"></div>
        <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-blue-600 border-r-blue-600 rounded-full animate-spin"></div>
        <div className="absolute top-2 left-2 w-12 h-12 border-4 border-transparent border-t-purple-500 border-l-purple-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
      </div>
      
      {/* Message */}
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-gray-900">
          {message}{dots}
        </h3>
        {submessage && (
          <p className="text-sm text-gray-600 max-w-sm">
            {submessage}
          </p>
        )}
      </div>

      {/* Progress bar */}
      {showProgress && typeof progress === 'number' && (
        <div className="w-64 mt-4">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

interface GenerationLoadingProps {
  jobName?: string
  onCancel?: () => void
}

export function GenerationLoading({ jobName, onCancel }: GenerationLoadingProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress] = useState(0)

  const steps = [
    'Analyzing your image...',
    'Understanding your prompt...',
    'Generating AI magic...',
    'Adding finishing touches...',
    'Almost ready!'
  ]

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setCurrentStep(prev => (prev + 1) % steps.length)
    }, 3000)

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + Math.random() * 10
        return newProgress > 95 ? 95 : newProgress
      })
    }, 1000)

    return () => {
      clearInterval(stepInterval)
      clearInterval(progressInterval)
    }
  }, [steps.length])

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-lg">
      <div className="text-center">
        {/* AI Animation */}
        <div className="relative mb-6">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg animate-pulse">
              AI
            </div>
          </div>
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-20 h-20 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
        </div>

        <h3 className="text-xl font-bold text-gray-900 mb-2">
          Creating {jobName ? `"${jobName}"` : 'Your Ad'}
        </h3>
        
        <p className="text-gray-600 mb-6">
          {steps[currentStep]}
        </p>

        {/* Progress bar */}
        <div className="w-full max-w-sm mx-auto mb-6">
          <div className="flex justify-between text-xs text-gray-600 mb-2">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-blue-600 to-purple-600 h-3 rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white opacity-30 animate-pulse"></div>
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-500 mb-4">
          This usually takes 30-60 seconds
        </div>

        {onCancel && (
          <button
            onClick={onCancel}
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancel Generation
          </button>
        )}
      </div>
    </div>
  )
}