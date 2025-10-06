'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Image from 'next/image'
import { resizeImageFile, validateImageFile } from '@/lib/client-resize'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/validations'
import { ToastContainer, useToast } from '@/components/Toast'

interface ChatInterfaceProps {
  user: User
  profile: Profile
}

interface UploadedImage {
  id: string
  url: string
  name: string
  file?: File
}

type AspectRatio = 'square' | 'portrait' | 'landscape'

// Helper function to convert storage path to public URL
function getPublicUrl(path: string): string {
  const supabase = createClient()
  const { data } = supabase.storage
    .from('results')
    .getPublicUrl(path)
  return data?.publicUrl || ''
}

export default function ChatInterface({ user, profile }: ChatInterfaceProps) {
  const [prompt, setPrompt] = useState('')
  const [images, setImages] = useState<UploadedImage[]>([])
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('square')
  const [isUploading, setIsUploading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const { toasts, addToast, removeToast, updateToast } = useToast()
  const [loadingToastId, setLoadingToastId] = useState<string | null>(null)



  // Handle file upload
  const handleFileUpload = useCallback(async (files: FileList) => {
    if (files.length === 0) return

    setIsUploading(true)
    const newImages: UploadedImage[] = []

    try {
      for (const file of Array.from(files)) {
        // Validate file
        const validation = validateImageFile(file)
        if (!validation.valid) {
          console.error('Invalid file:', validation.error)
          continue
        }

        // Resize image
        const resized = await resizeImageFile(file, {
          maxSide: 1024,
          quality: 0.8,
          format: 'jpeg',
          maxOutputSize: 2_500_000
        })

        // Create temporary preview URL
        const blob = new Blob([resized.arrayBuffer], { type: 'image/jpeg' })
        const previewUrl = URL.createObjectURL(blob)

        const newImage: UploadedImage = {
          id: `temp_${Date.now()}_${Math.random()}`,
          url: previewUrl,
          name: file.name,
          file
        }

        newImages.push(newImage)
      }

      setImages(prev => [...prev, ...newImages])
    } catch (error) {
      console.error('Error processing images:', error)
    } finally {
      setIsUploading(false)
    }
  }, [])

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileUpload(files)
    }
  }, [handleFileUpload])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    // Only set dragOver to false if we're leaving the main container
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(false)
    }
  }, [])

  // Remove image
  const removeImage = (id: string) => {
    setImages(prev => {
      const image = prev.find(img => img.id === id)
      if (image?.url.startsWith('blob:')) {
        URL.revokeObjectURL(image.url)
      }
      return prev.filter(img => img.id !== id)
    })
  }

  // Generate ad
  const handleGenerate = async () => {
    if (!prompt.trim()) return

    // Check credits before starting
    if (profile.credits <= 0) {
      addToast({
        message: '⚠️ You have run out of credits! Redirecting to billing to top up your account.',
        type: 'error'
      })
      setTimeout(() => {
        window.location.href = '/billing'
      }, 2000)
      return
    }

    setIsGenerating(true)

    try {
      // Use null folder for all chat generations (no folder structure)
      const folderId = null
      const imageIds: string[] = []

      // Upload images if any exist
      if (images.length > 0) {
        for (const image of images) {
          if (!image.file) continue

          // Resize and upload the image
          const resized = await resizeImageFile(image.file, {
            maxSide: 1024,
            quality: 0.8,
            format: 'jpeg',
            maxOutputSize: 2_500_000
          })

          // Upload to storage
          const fileName = `${user.id}/uploads/${Date.now()}_${image.file.name}`
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('uploads')
            .upload(fileName, resized.arrayBuffer, {
              contentType: 'image/jpeg',
              upsert: false
            })

          if (uploadError) throw uploadError

          // Save to database
          const { data: imageData, error: imageError } = await supabase
            .from('images')
            .insert({
              user_id: user.id,
              folder_id: folderId,
              file_path: uploadData.path,
              original_name: image.file.name,
              file_size: resized.arrayBuffer.byteLength,
              mime_type: 'image/jpeg'
            })
            .select()
            .single()

          if (imageError) throw imageError

          imageIds.push(imageData.id)
        }
      }

      // Generate the ad
      console.log('[ChatInterface] About to call generate-ad API with:', {
        imageIds,
        prompt: prompt.trim(),
        aspectRatio,
        jobName: prompt.trim() || `Generated ${new Date().toLocaleString()}`,
        folderId: folderId,
        hasImages: images.length > 0
      })
      
      const generateResponse = await fetch('/api/generate-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageIds,
          prompt: prompt.trim(),
          aspectRatio,
          jobName: prompt.trim() || `Generated ${new Date().toLocaleString()}`,
          folderId: folderId
        })
      })
      
      console.log('[ChatInterface] Generate-ad API response:', generateResponse.status, generateResponse.statusText)

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json()
        if (generateResponse.status === 402) {
          // Show notification and redirect to billing
          addToast({
            message: '⚠️ You have run out of credits! Redirecting to billing to top up your account.',
            type: 'error'
          })
          setTimeout(() => {
            window.location.href = '/billing'
          }, 2000)
          return
        }
        throw new Error(errorData.error || 'Failed to generate ad')
      }

      const { jobId } = await generateResponse.json()
      
      // Show loading toast
      const toastId = addToast({
        message: 'Creating your ad... This usually takes 30-60 seconds.',
        type: 'loading'
      })
      setLoadingToastId(toastId)
      
      // Clear the form
      setPrompt('')
      setImages([])
      
      // Start polling for result with original prompt
      pollForResult(jobId, prompt.trim(), folderId || 'uploads')

    } catch (error) {
      console.error('Generation error:', error)
      
      // Clean up loading toast if it exists
      if (loadingToastId) {
        removeToast(loadingToastId)
        setLoadingToastId(null)
      }
      
      addToast({
        message: 'Failed to generate ad. Please try again.',
        type: 'error'
      })
    } finally {
      setIsGenerating(false)
    }
  }

  // Poll for generation result and redirect when complete
  const pollForResult = async (jobId: string, originalPrompt: string, folderId: string) => {
    const maxAttempts = 60 // 5 minutes max
    let attempts = 0

    const poll = async () => {
      try {
        console.log(`[ChatInterface] Polling job ${jobId}, attempt ${attempts + 1}`)
        const response = await fetch(`/api/jobs/${jobId}`)
        if (!response.ok) {
          console.error(`[ChatInterface] Job polling failed:`, response.status, response.statusText)
          return
        }

        const job = await response.json()
        console.log(`[ChatInterface] Job status:`, job.status, job)
        
        if (job.status === 'completed' && job.result_url) {
          // Stop generating state
          setIsGenerating(false)
          
          // Update loading toast to success
          if (loadingToastId) {
            updateToast(loadingToastId, {
              message: 'Ad created successfully! Redirecting to your library...',
              type: 'success'
            })
            setTimeout(() => {
              if (loadingToastId) removeToast(loadingToastId)
            }, 1500)
          }
          
          // Navigate to library to see the generated image
          setTimeout(() => {
            window.location.href = `/dashboard/library`
          }, 1500)
          return
        }

        if (job.status === 'failed') {
          console.error('Generation failed:', job.error_message)
          setIsGenerating(false)
          
          // Update loading toast to error
          if (loadingToastId) {
            updateToast(loadingToastId, {
              message: 'Generation failed. Please try again.',
              type: 'error'
            })
            setLoadingToastId(null)
          } else {
            addToast({
              message: 'Generation failed. Please try again.',
              type: 'error'
            })
          }
          return
        }

        // Continue polling if still pending or processing
        if ((job.status === 'pending' || job.status === 'processing') && attempts < maxAttempts) {
          attempts++
          setTimeout(poll, 5000) // Poll every 5 seconds
        } else if (attempts >= maxAttempts) {
          setIsGenerating(false)
          
          // Update loading toast to timeout error
          if (loadingToastId) {
            updateToast(loadingToastId, {
              message: 'Generation timed out. Please check your library.',
              type: 'error'
            })
            setLoadingToastId(null)
          } else {
            addToast({
              message: 'Generation timed out. Please check your library.',
              type: 'error'
            })
          }
        }
      } catch (error) {
        console.error('Polling error:', error)
        setIsGenerating(false)
      }
    }

    poll()
  }

  return (
    <div className="h-full flex flex-col">
      {/* Main Content Area */}
      <div 
        className={`flex-1 relative transition-all duration-200 ${
          dragOver ? 'bg-blue-50 border-2 border-dashed border-blue-300' : ''
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* Drag Overlay */}
        {dragOver && (
          <div className="absolute inset-0 bg-blue-50/80 flex items-center justify-center z-10 pointer-events-none">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-lg font-medium text-blue-900">Drop images here</p>
              <p className="text-sm text-blue-700">Release to upload your images</p>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="h-full flex flex-col p-6">
          {/* Generating State */}
          {isGenerating && (
            <div className="mb-8">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
                <h3 className="text-lg font-medium text-blue-900 mb-2">
                  Creating Your Ad...
                </h3>
                <p className="text-blue-700 text-sm">
                  Our AI is working on your request. You'll be automatically redirected to your library when it's ready!
                </p>
              </div>
            </div>
          )}

          {/* Welcome Message */}
          {!isGenerating && (
            <div className="flex-1 flex items-center justify-center">
              <div className="max-w-2xl text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                  Create Amazing Ads with AI
                </h1>
                <p className="text-lg text-gray-600 mb-8">
                  Describe what you want, add reference images if you'd like, and let AI create professional advertisements for you.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-500">
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Drag & drop images</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span>Describe your vision</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Get instant results</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Image Previews */}
          {images.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">
                  Reference Images ({images.length})
                </h3>
                <button
                  onClick={() => {
                    images.forEach(img => {
                      if (img.url.startsWith('blob:')) {
                        URL.revokeObjectURL(img.url)
                      }
                    })
                    setImages([])
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                {images.map((image) => (
                  <div key={image.id} className="relative group">
                    <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                      <Image
                        src={image.url}
                        alt={image.name}
                        width={80}
                        height={80}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      onClick={() => removeImage(image.id)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
            {/* Aspect Ratio Selector */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Aspect Ratio:</span>
                <div className="flex space-x-2">
                  {([
                    { key: 'square', label: 'Square', icon: '⬜' },
                    { key: 'portrait', label: 'Portrait', icon: '📱' },
                    { key: 'landscape', label: 'Landscape', icon: '🖥️' }
                  ] as const).map(({ key, label, icon }) => (
                    <button
                      key={key}
                      onClick={() => setAspectRatio(key)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        aspectRatio === key
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent'
                      }`}
                    >
                      <span className="mr-1">{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Text Input */}
            <div className="p-4">
              <div className="flex items-start space-x-3">
                {/* Image Upload Button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex-shrink-0 w-12 h-12 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 mt-1"
                >
                  {isUploading ? (
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 002 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>

                {/* Text Input */}
                <div className="flex-1">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the ad you want to create... (e.g., 'A summer sale banner with bright colors' or 'Professional product showcase for a tech gadget')"
                    className="w-full min-h-[60px] max-h-32 px-4 py-3 border-0 resize-none focus:outline-none text-gray-900 placeholder-gray-500 rounded-xl bg-gray-50"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        if (prompt.trim()) {
                          handleGenerate()
                        }
                      }
                    }}
                  />
                </div>

                {/* Send Button */}
                <button
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || isGenerating}
                  className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all mt-1 ${
                    prompt.trim() && !isGenerating
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isGenerating ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Credits Info */}
              <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                <span>
                  {images.length > 0 
                    ? `${images.length} reference image${images.length !== 1 ? 's' : ''} • ` 
                    : 'Text-only generation • '
                  }
                  Press Enter to send
                </span>
                <span>
                  {profile.credits} credits remaining
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            if (e.target.files) {
              handleFileUpload(e.target.files)
            }
          }}
          className="hidden"
        />
      </div>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onCloseAction={removeToast} />
    </div>
  )
}