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
  const [isMobile, setIsMobile] = useState(false)

  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const { toasts, addToast, removeToast, updateToast } = useToast()
  const [loadingToastId, setLoadingToastId] = useState<string | null>(null)

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Check for pending jobs on mount (in case of page refresh)
  useEffect(() => {
    const checkPendingJobs = async () => {
      try {
        const { data: pendingJobs, error } = await supabase
          .from('jobs')
          .select('id, prompt, status, created_at')
          .eq('user_id', user.id)
          .in('status', ['pending', 'processing'])
          .order('created_at', { ascending: false })
          .limit(1)

        if (error || !pendingJobs || pendingJobs.length === 0) return

        const latestPendingJob = pendingJobs[0]
        const jobAge = Date.now() - new Date(latestPendingJob.created_at).getTime()
        
        // Only show loading for jobs less than 5 minutes old
        if (jobAge < 5 * 60 * 1000) {
          console.log('[ChatInterface] Found pending job on refresh:', latestPendingJob)
          
          const toastId = addToast({
            message: 'Continuing your ad generation... This usually takes 30-60 seconds.',
            type: 'loading'
          })
          setLoadingToastId(toastId)

          // Subscribe to this existing job
          subscribeToJobUpdates(latestPendingJob.id, latestPendingJob.prompt, 'uploads')
        }
      } catch (error) {
        console.error('[ChatInterface] Error checking pending jobs:', error)
      }
    }

    checkPendingJobs()
  }, [user.id, supabase, addToast])



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

    // Show loading toast immediately (but don't disable the chat interface)
    const toastId = addToast({
      message: 'Creating your ad... This usually takes 30-60 seconds.',
      type: 'loading'
    })
    setLoadingToastId(toastId)

    try {
      // Use null folder for all chat generations (no folder structure)
      const folderId = null
      const imageIds: string[] = []

      // Upload images if any exist
      if (images.length > 0) {
        console.log(`[ChatInterface] Starting upload of ${images.length} images`)
        
        for (const image of images) {
          if (!image.file) {
            console.log(`[ChatInterface] Skipping image ${image.id} - no file object`)
            continue
          }

          console.log(`[ChatInterface] Processing image: ${image.file.name}`)

          try {
            // Resize and upload the image
            const resized = await resizeImageFile(image.file, {
              maxSide: 1024,
              quality: 0.8,
              format: 'jpeg',
              maxOutputSize: 2_500_000
            })

            console.log(`[ChatInterface] Resized image: ${resized.arrayBuffer.byteLength} bytes`)

            // Upload to storage
            const fileName = `${user.id}/uploads/${Date.now()}_${image.file.name}`
            console.log(`[ChatInterface] Uploading to storage: ${fileName}`)
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('uploads')
              .upload(fileName, resized.arrayBuffer, {
                contentType: 'image/jpeg',
                upsert: false
              })

            if (uploadError) {
              console.error(`[ChatInterface] Storage upload error:`, uploadError)
              throw uploadError
            }

            console.log(`[ChatInterface] Storage upload successful: ${uploadData.path}`)

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

            if (imageError) {
              console.error(`[ChatInterface] Database insert error:`, imageError)
              throw imageError
            }

            console.log(`[ChatInterface] Database insert successful: ${imageData.id}`)
            imageIds.push(imageData.id)
            
          } catch (imageProcessError) {
            console.error(`[ChatInterface] Error processing image ${image.file.name}:`, imageProcessError)
            throw imageProcessError
          }
        }
        
        console.log(`[ChatInterface] All images processed. Final imageIds:`, imageIds)
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

      // Add smooth swoop animation to show submission
      const textarea = document.querySelector('textarea') as HTMLTextAreaElement
      if (textarea) {
        textarea.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out'
        textarea.style.transform = 'translateY(-10px)'
        textarea.style.opacity = '0.5'
        
        // Clear after animation
        setTimeout(() => {
          setPrompt('')
          setImages([])
          textarea.style.transform = 'translateY(0)'
          textarea.style.opacity = '1'
        }, 300)
      }
      
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

      const result = await generateResponse.json()
      
      if (result.success && result.result_path) {
        // Generation completed immediately! Update loading toast to success
        if (loadingToastId) {
          updateToast(loadingToastId, {
            message: 'Ad created successfully! Redirecting to your library...',
            type: 'success'
          })
          setTimeout(() => {
            if (loadingToastId) removeToast(loadingToastId)
          }, 1500)
        }
        
        // Redirect to library immediately
        setTimeout(() => {
          window.location.href = `/dashboard/library`
        }, 1500)
        
      } else {
        // Fallback to real-time subscription if needed
        const { jobId } = result
        
        // Start real-time subscription for result with original prompt
        subscribeToJobUpdates(jobId, prompt.trim(), folderId || 'uploads')
      }

    } catch (error) {
      console.error('[ChatInterface] Generation error details:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        imagesLength: images.length,
        promptLength: prompt.length
      })
      
      // Clean up loading toast if it exists
      if (loadingToastId) {
        removeToast(loadingToastId)
        setLoadingToastId(null)
      }
      
      addToast({
        message: `Failed to generate ad: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error'
      })
    }
  }

  // Subscribe to job status changes using Supabase real-time
  const subscribeToJobUpdates = (jobId: string, originalPrompt: string, folderId: string) => {
    console.log(`[ChatInterface] Subscribing to job updates for ${jobId}`)
    
    const channel = supabase
      .channel(`job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `id=eq.${jobId}`
        },
        (payload) => {
          console.log('[ChatInterface] Job update received:', payload)
          const job = payload.new
          
          if (job.status === 'completed' && job.result_url) {
            console.log('[ChatInterface] Job completed successfully!')
            
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
            
            // Unsubscribe from channel
            channel.unsubscribe()
            
          } else if (job.status === 'failed') {
            console.error('[ChatInterface] Generation failed:', job.error_message)
            
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
            
            // Unsubscribe from channel
            channel.unsubscribe()
          }
        }
      )
      .subscribe((status) => {
        console.log('[ChatInterface] Subscription status:', status)
      })
    
    // Set up a timeout as fallback (5 minutes)
    const timeoutId = setTimeout(() => {
      console.log('[ChatInterface] Job subscription timeout reached')
      
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
      
      // Unsubscribe from channel
      channel.unsubscribe()
    }, 5 * 60 * 1000) // 5 minutes
    
    // Clean up timeout when component unmounts or job completes
    const originalUnsubscribe = channel.unsubscribe
    channel.unsubscribe = () => {
      clearTimeout(timeoutId)
      return originalUnsubscribe.call(channel)
    }
    
    return channel
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
        <div className="h-full flex flex-col p-3 sm:p-6">
          {/* Generating State */}
          {isGenerating && (
            <div className="mb-4 sm:mb-8">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 sm:p-6 text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
                <h3 className="text-base sm:text-lg font-medium text-blue-900 mb-2">
                  Creating Your Ad...
                </h3>
                <p className="text-blue-700 text-xs sm:text-sm">
                  Our AI is working on your request. You'll be automatically redirected to your library when it's ready!
                </p>
              </div>
            </div>
          )}

          {/* Welcome Message */}
          {!isGenerating && (
            <div className="flex-1 flex items-center justify-center">
              <div className="max-w-2xl text-center px-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">
                  Create Stunning Lifestyle Images
                </h1>
                <p className="text-base sm:text-lg text-gray-600 mb-6 sm:mb-8">
                  Describe what you want, add reference images if you'd like, and let AI create beautiful lifestyle content for you.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <button
                    onClick={() => setPrompt("A photorealistic image of a steaming ceramic coffee mug with a modern minimalist logo, placed on a wooden breakfast table near a bright window. Soft morning sunlight, cozy home atmosphere, blurred background.")}
                    className="p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-lg border border-blue-200 transition-all duration-200 hover:shadow-md text-left"
                  >
                    <div className="text-sm sm:text-base font-medium text-blue-900 mb-1">
                      ☕ Morning Coffee Moment
                    </div>
                    <div className="text-xs sm:text-sm text-blue-600">
                      Steaming mug on wooden table
                    </div>
                  </button>
                  <button
                    onClick={() => setPrompt("A hyperrealistic studio photo of a white skincare serum bottle with silver pump and clean typography label. Neutral gray background, soft shadow below, elegant product lighting, glossy highlights.")}
                    className="p-3 sm:p-4 bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 rounded-lg border border-purple-200 transition-all duration-200 hover:shadow-md text-left"
                  >
                    <div className="text-sm sm:text-base font-medium text-purple-900 mb-1">
                      🧴 Minimal Beauty Bottle
                    </div>
                    <div className="text-xs sm:text-sm text-purple-600">
                      White serum bottle, studio lighting
                    </div>
                  </button>
                  <button
                    onClick={() => setPrompt("A realistic image of a blue sports water bottle with bold white branding on a running track at sunrise. Slight motion blur of a runner in the background, dynamic composition, warm sunlight and clear sky.")}
                    className="p-3 sm:p-4 bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 rounded-lg border border-green-200 transition-all duration-200 hover:shadow-md text-left"
                  >
                    <div className="text-sm sm:text-base font-medium text-green-900 mb-1">
                      🏃 Sport Bottle in Action
                    </div>
                    <div className="text-xs sm:text-sm text-green-600">
                      Blue bottle on running track at sunrise
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Image Previews */}
          {images.length > 0 && (
            <div className="mb-4 sm:mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs sm:text-sm font-medium text-gray-700">
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
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {images.map((image) => (
                  <div key={image.id} className="relative group">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
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
                      className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 w-5 h-5 sm:w-6 sm:h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
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
            <div className="p-3 sm:p-4 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="text-xs sm:text-sm font-medium text-gray-700">Aspect Ratio:</span>
                <div className="flex space-x-1 sm:space-x-2">
                  {([
                    { key: 'square', label: 'Square', icon: '⬜' },
                    { key: 'portrait', label: 'Portrait', icon: '📱' },
                    { key: 'landscape', label: 'Landscape', icon: '🖥️' }
                  ] as const).map(({ key, label, icon }) => (
                    <button
                      key={key}
                      onClick={() => setAspectRatio(key)}
                      className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                        aspectRatio === key
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent'
                      }`}
                    >
                      <span className="mr-1">{icon}</span>
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Text Input */}
            <div className="p-3 sm:p-4">
              <div className="flex items-start space-x-2 sm:space-x-3">
                {/* Image Upload Button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 mt-1"
                >
                  {isUploading ? (
                    <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  )}
                </button>

                {/* Text Input */}
                <div className="flex-1">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={isMobile 
                      ? "Describe the image you want to create..."
                      : "Describe the image you want to create... (e.g., 'A summer lifestyle photo with bright colors' or 'Professional product showcase for a tech gadget')"
                    }
                    className="w-full min-h-[50px] sm:min-h-[60px] max-h-32 px-3 py-2 sm:px-4 sm:py-3 border-0 resize-none focus:outline-none text-sm sm:text-base text-gray-900 placeholder-gray-500 rounded-xl bg-gray-50"
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
                  className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all mt-1 ${
                    prompt.trim() && !isGenerating
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isGenerating ? (
                    <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Credits Info */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-3 gap-1 sm:gap-0 text-xs text-gray-500">
                <span className="text-center sm:text-left">
                  {images.length > 0 
                    ? `${images.length} reference image${images.length !== 1 ? 's' : ''} • ` 
                    : ''
                  }
                </span>
                <span className="text-center sm:text-right font-medium">
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