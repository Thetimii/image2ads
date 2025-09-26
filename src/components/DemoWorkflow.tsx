'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
// Using basic icons instead of lucide-react
import { createClient } from '@/lib/supabase/client'

interface DemoWorkflowProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
}

const DEMO_MOCKUP_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/demo/demomockup.png`
const DEMO_RESULT_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/demo/demoresult.png`

export default function DemoWorkflow({ isOpen, onClose, onComplete }: DemoWorkflowProps) {
  const [currentStep, setCurrentStep] = useState<'upload' | 'generate' | 'processing' | 'result'>('upload')
  const [isGenerating, setIsGenerating] = useState(false)
  const [demoPrompt, setDemoPrompt] = useState('Make a model wear the tote bag mockup')

  const handleStartDemo = () => {
    setCurrentStep('generate')
  }

  const handleGenerateDemo = async () => {
    setIsGenerating(true)
    setCurrentStep('processing')
    
    // Simulate generation time (2-3 seconds)
    setTimeout(() => {
      setCurrentStep('result')
      setIsGenerating(false)
    }, 2500)
  }

  const handleCompleteDemo = () => {
    onComplete()
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-lg sm:rounded-2xl shadow-2xl max-w-5xl w-full h-fit max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-white text-sm">✨</span>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                  {currentStep === 'upload' && 'Try Image2Ad Demo'}
                  {currentStep === 'generate' && 'Generate Your Ad'}
                  {currentStep === 'processing' && 'Creating Your Ad...'}
                  {currentStep === 'result' && 'Your Ad is Ready! 🎉'}
                </h2>
                <p className="text-sm text-gray-600">
                  {currentStep === 'upload' && 'See how Image2Ad transforms your product photos'}
                  {currentStep === 'generate' && 'Describe the ad you want to create'}
                  {currentStep === 'processing' && 'Our AI is crafting your professional advertisement'}
                  {currentStep === 'result' && 'Here\'s your professionally generated ad'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-gray-700 text-xl"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6">
            {/* Upload Step */}
            {currentStep === 'upload' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-6"
              >
                <div className="relative">
                  <img
                    src={DEMO_MOCKUP_URL}
                    alt="Demo product"
                    className="w-48 h-48 sm:w-64 sm:h-64 object-cover mx-auto rounded-xl shadow-lg"
                  />
                  <div className="absolute -top-2 -right-2 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                    Demo Image
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    We've loaded a sample product image for you
                  </h3>
                  <p className="text-gray-600">
                    This is how your product photos would appear after upload. 
                    Now let's see how Image2Ad transforms them into professional ads!
                  </p>
                  <button
                    onClick={handleStartDemo}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    Generate Ad from This Image
                  </button>
                </div>
              </motion.div>
            )}

            {/* Generate Step */}
            {currentStep === 'generate' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4 sm:space-y-6"
              >
                <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 mb-2">Your Selected Image</h3>
                    <div className="w-full bg-gray-50 rounded-lg p-2">
                      <img
                        src={DEMO_MOCKUP_URL}
                        alt="Selected demo product"
                        className="w-full h-auto object-contain rounded-lg shadow-sm max-h-48"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ad Name
                      </label>
                      <input
                        type="text"
                        value="Professional Product Demo"
                        readOnly
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Describe Your Ad
                      </label>
                      <textarea
                        value={demoPrompt}
                        readOnly
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 h-24 resize-none cursor-default"
                        placeholder="Describe the kind of advertisement you want..."
                      />
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-blue-800 text-sm font-medium mb-1">
                        <span>✨</span>
                        Demo Mode
                      </div>
                      <p className="text-blue-700 text-sm">
                        This demo won't use credits or make API calls - we'll show you a pre-made result!
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleGenerateDemo}
                    disabled={isGenerating}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
                  >
                    <span>🪄</span>
                    Generate Demo Ad
                  </button>
                </div>
              </motion.div>
            )}

            {/* Processing Step */}
            {currentStep === 'processing' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-6 py-8"
              >
                <div className="flex justify-center">
                  <div className="relative w-16 h-16">
                    <div className="w-16 h-16 border-4 border-blue-200 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <div className="absolute top-2 left-2 w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-lg">🪄</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Generating Your Professional Ad
                  </h3>
                  <p className="text-sm text-gray-600 max-w-sm mx-auto">
                    Our AI is analyzing your image and creating a stunning advertisement...
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 max-w-md mx-auto">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                    <span>Progress</span>
                    <span>Creating...</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div className="h-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full animate-pulse w-full" />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Result Step */}
            {currentStep === 'result' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <span className="text-xl">✓</span>
                    <span className="text-base font-semibold">Generation Complete!</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Here's your before and after - see how Image2Ad transforms your product photos!
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="text-center space-y-2">
                    <h4 className="text-sm font-semibold text-gray-700">Original Image</h4>
                    <div className="w-full bg-gray-50 rounded-lg p-2">
                      <img
                        src={DEMO_MOCKUP_URL}
                        alt="Original demo product"
                        className="w-full h-auto object-contain rounded-lg shadow-sm max-h-48"
                      />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <h4 className="text-sm font-semibold text-gray-700">Generated Ad</h4>
                    <div className="w-full bg-gray-50 rounded-lg p-2 relative">
                      <img
                        src={DEMO_RESULT_URL}
                        alt="Generated demo ad"
                        className="w-full h-auto object-contain rounded-lg shadow-sm max-h-48"
                      />
                      <div className="absolute -top-1 -right-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                        AI Generated
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4 text-center space-y-3 mt-4">
                  <h3 className="text-base font-semibold text-gray-900">
                    Amazing, right? This is what Image2Ad can do for your business!
                  </h3>
                  <p className="text-sm text-gray-600">
                    Ready to try it with your own images?
                  </p>
                  <button
                    onClick={handleCompleteDemo}
                    className="bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2 mx-auto text-sm"
                  >
                    Now Use Your Own Product
                    <span>→</span>
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}