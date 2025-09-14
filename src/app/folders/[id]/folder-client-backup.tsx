'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import type { Profile, Folder, Image, Job } from '@/lib/validations'
import DashboardLayout from '@/components/DashboardLayout'

interface FolderClientProps {
  user: User
  profile: Profile
  folder: Folder
  initialImages: Image[]
}

export default function FolderClient({ user, profile, folder, initialImages }: FolderClientProps) {
  const [images, setImages] = useState(initialImages)
  const [jobs, setJobs] = useState<Job[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('gemini')
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showDeleteFolderModal, setShowDeleteFolderModal] = useState(false)
  const [imageToDelete, setImageToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [enhancementStatus, setEnhancementStatus] = useState<Record<string, string>>({})
  const supabase = createClient()
  const router = useRouter()

  // Subscribe to job status changes
  useEffect(() => {
    const channel = supabase
      .channel('jobs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Job update:', payload)
          fetchJobs()
        }
      )
      .subscribe()

    fetchJobs()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user.id, supabase])

  const fetchJobs = async () => {
    try {
      const response = await fetch('/api/jobs')
      if (response.ok) {
        const { jobs } = await response.json()
        setJobs(jobs)
      }
    } catch (error) {
      console.error('Error fetching jobs:', error)
    }
  }

  const handleDeleteImage = async () => {
    if (!imageToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/images/${imageToDelete}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setImages(images.filter(img => img.id !== imageToDelete))
        setSelectedImages(selectedImages.filter(id => id !== imageToDelete))
        setShowDeleteModal(false)
        setImageToDelete(null)
      } else {
        alert('Failed to delete image')
      }
    } catch (error) {
      console.error('Error deleting image:', error)
      alert('Failed to delete image')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteFolder = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/folders/${folder.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        router.push('/dashboard')
      } else {
        alert('Failed to delete folder')
      }
    } catch (error) {
      console.error('Error deleting folder:', error)
      alert('Failed to delete folder')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // Validate files
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        alert('Please upload only image files')
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('Each file must be less than 10MB')
        return
      }
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      const uploadedImages = []
      const totalFiles = files.length

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setUploadProgress((i / totalFiles) * 100)

        // Get upload URL
        const uploadResponse = await fetch('/api/upload-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            folderId: folder.id,
          }),
        })

        if (!uploadResponse.ok) {
          throw new Error(`Failed to get upload URL for ${file.name}`)
        }

        const { uploadUrl, filePath, fileName } = await uploadResponse.json()

        // Upload file to Supabase storage
        const uploadResult = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        })

        if (!uploadResult.ok) {
          throw new Error(`Failed to upload ${file.name}`)
        }

        // Create image record in database
        const { data: imageData, error: imageError } = await supabase
          .from('images')
          .insert({
            folder_id: folder.id,
            user_id: user.id,
            original_name: file.name,
            file_path: filePath,
            file_size: file.size,
            mime_type: file.type,
          })
          .select()
          .single()

        if (imageError) {
          throw new Error(`Failed to save image record for ${file.name}`)
        }

        uploadedImages.push(imageData)
      }

      setImages([...uploadedImages, ...images])
      setUploadProgress(100)
    } catch (error) {
      console.error('Upload error:', error)
      alert(`Failed to upload files: ${error}`)
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const generateAd = async () => {
    if (selectedImages.length === 0) {
      alert('Please select at least one image to generate an ad.')
      return
    }

    if (selectedImages.length > 10) {
      alert('Maximum 10 images can be selected for generation.')
      return
    }

    if (!prompt.trim()) {
      alert('Please enter a prompt for the ad generation.')
      return
    }

    if (profile.credits < 1) {
      alert('Insufficient credits. Please upgrade your plan.')
      return
    }

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_ids: selectedImages,
          prompt: prompt.trim(),
          model: model,
          credits_used: 1,
        }),
      })

      if (response.ok) {
        alert('Generation started! Check your jobs for progress.')
        setShowGenerateModal(false)
        setSelectedImages([])
        setPrompt('')
        fetchJobs()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to start generation')
      }
    } catch (error) {
      console.error('Generation error:', error)
      alert('Failed to start generation. Please try again.')
    }
  }

  const toggleImageSelection = (imageId: string) => {
    setSelectedImages(prev => 
      prev.includes(imageId) 
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId]
    )
  }

  const getImageUrl = async (image: Image) => {
    const { data } = await supabase.storage
      .from('uploads')
      .createSignedUrl(image.file_path, 300)
    return data?.signedUrl
  }

  const handleEnhanceImage = async (jobId: string, imageUrl: string) => {
    try {
      setEnhancementStatus(prev => ({ ...prev, [jobId]: 'enhancing' }))

      const response = await fetch('/api/enhance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: imageUrl,
          resultId: jobId,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setEnhancementStatus(prev => ({ ...prev, [jobId]: 'completed' }))
        
        // Open enhanced image in new tab
        window.open(result.enhancedImageUrl, '_blank')
        
        // Show success message
        alert('🎉 Image enhanced successfully! The high-quality version has opened in a new tab. The enhanced image has better resolution, sharpness, and details.')
      } else {
        throw new Error(result.error || 'Failed to enhance image')
      }
    } catch (error) {
      console.error('Enhancement error:', error)
      setEnhancementStatus(prev => ({ ...prev, [jobId]: 'failed' }))
      
      let errorMessage = 'Unknown error occurred'
      if (error instanceof Error) {
        errorMessage = error.message
      }
      
      // Provide helpful error messages
      if (errorMessage.includes('VYRO API key')) {
        errorMessage = 'Image enhancement service is not configured. Please contact support.'
      } else if (errorMessage.includes('Failed to fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.'
      }
      
      alert(`❌ Enhancement failed: ${errorMessage}`)
    }
  }

  return (
    <DashboardLayout user={user} profile={profile}>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{folder.name}</h1>
              <p className="text-gray-600">
                Upload images and generate professional ads with AI.
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowDeleteFolderModal(true)}
                className="flex items-center space-x-2 text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="text-sm font-medium">Delete Folder</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Images</p>
                <p className="text-2xl font-bold text-gray-900">{images.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Selected</p>
                <p className="text-2xl font-bold text-gray-900">{selectedImages.length}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Generated Ads</p>
                <p className="text-2xl font-bold text-gray-900">{jobs.filter(j => j.status === 'completed').length}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Available Credits</p>
                <p className="text-2xl font-bold text-gray-900">{profile.credits}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Upload section */}
        <div className="bg-white rounded-2xl border border-gray-200 mb-8 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Upload Images</h2>
            <p className="text-sm text-gray-600 mt-1">Add new images to your folder</p>
          </div>
          
          <div className="p-6">
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-blue-400 transition-colors duration-200">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <label htmlFor="file-upload" className="cursor-pointer block">
                  <span className="text-lg font-medium text-gray-900 block mb-2">
                    {isUploading ? `Uploading... ${uploadProgress.toFixed(0)}%` : 'Upload Images'}
                  </span>
                  <span className="text-sm text-gray-600">
                    Click to browse or drag and drop multiple files
                  </span>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                </label>
                <p className="text-xs text-gray-500 mt-3">PNG, JPG, WEBP up to 10MB each</p>
                
                {isUploading && (
                  <div className="mt-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Images section */}
        {images.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 mb-8 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Your Images</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Select images to generate ads • {selectedImages.length} of {Math.min(images.length, 10)} selected
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setSelectedImages([])}
                    className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    disabled={selectedImages.length === 0}
                  >
                    Clear All
                  </button>
                  <button
                    onClick={() => setSelectedImages(images.slice(0, 10).map(img => img.id))}
                    className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                    disabled={images.length === 0}
                  >
                    Select All
                  </button>
                  {selectedImages.length > 0 && (
                    <button
                      onClick={() => setShowGenerateModal(true)}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg shadow-blue-500/20"
                    >
                      Generate Ad ({selectedImages.length})
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {images.map((image) => (
                  <ImageCard
                    key={image.id}
                    image={image}
                    isSelected={selectedImages.includes(image.id)}
                    onSelect={() => {
                      if (selectedImages.includes(image.id)) {
                        setSelectedImages(selectedImages.filter(id => id !== image.id))
                      } else if (selectedImages.length < 10) {
                        setSelectedImages([...selectedImages, image.id])
                      }
                    }}
                    onDelete={() => {
                      setImageToDelete(image.id)
                      setShowDeleteModal(true)
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Generated Ads section */}
        {jobs.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Generated Ads</h2>
              <p className="text-sm text-gray-600 mt-1">View and manage your AI-generated advertisements</p>
            </div>
            
            <div className="p-6 space-y-4">
              {jobs
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((job) => (
                  <JobCard 
                    key={job.id} 
                    job={job} 
                    onEnhance={handleEnhance}
                    enhancementStatus={enhancementStatus}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {images.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No images yet</h3>
              <p className="text-gray-600 mb-6 max-w-sm mx-auto">
                Upload your first images to start generating professional ads with AI.
              </p>
              <label
                htmlFor="file-upload-empty"
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Upload Images</span>
                <input
                  id="file-upload-empty"
                  name="file-upload-empty"
                  type="file"
                  className="sr-only"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Delete Image Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Image</h3>
              <p className="text-gray-600 text-sm">
                Are you sure you want to delete this image? This action cannot be undone.
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setImageToDelete(null)
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteImage}
                disabled={isDeleting}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isDeleting ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Deleting...</span>
                  </div>
                ) : (
                  'Delete Image'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Folder Modal */}
      {showDeleteFolderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Folder</h3>
              <p className="text-gray-600 text-sm">
                Are you sure you want to delete "{folder.name}"? This will permanently remove the folder and all its images. This action cannot be undone.
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteFolderModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteFolder}
                disabled={isDeleting}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isDeleting ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Deleting...</span>
                  </div>
                ) : (
                  'Delete Folder'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
                  </button>
                  <button
                    onClick={() => setSelectedImages(images.map((img: Image) => img.id))}
                    className="text-sm text-blue-600 hover:text-blue-800"
                    disabled={images.length > 10}
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setShowGenerateModal(true)}
                    disabled={selectedImages.length === 0}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Generate Ad (1 credit)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Images grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {images.map((image: Image) => (
              <ImageCard 
                key={image.id} 
                image={image} 
                isSelected={selectedImages.includes(image.id)}
                onToggleSelect={() => toggleImageSelection(image.id)}
                getImageUrl={getImageUrl}
              />
            ))}
          </div>

          {/* Jobs section */}
          {jobs.length > 0 && (
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Jobs</h2>
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="mb-4 p-3 bg-purple-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-purple-700">
                          <strong>✨ New:</strong> Click &quot;Enhance&quot; on completed jobs to upscale and improve image quality using AI!
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {jobs.slice(0, 10).map((job) => (
                      <JobCard 
                        key={job.id} 
                        job={job} 
                        onEnhance={handleEnhanceImage}
                        enhancementStatus={enhancementStatus}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {images.length === 0 && (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No images</h3>
              <p className="mt-1 text-sm text-gray-500">
                Upload your first image to get started.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Generate Advertisement
            </h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Selected images: {selectedImages.length}
              </p>
              
              <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-2">
                AI Model
              </label>
              <select
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              >
                <option value="gemini">Gemini (Fast, Multiple variations)</option>
                <option value="seedream">SeedDream v4 (Ultra High Quality 4K, Fashion focused)</option>
                <optgroup label="OpenAI GPT Image 1 - Low Quality (0.5 credits)">
                  <option value="openai-low-square">GPT Image 1 Low - Square (1024x1024)</option>
                  <option value="openai-low-landscape">GPT Image 1 Low - Landscape (1536x1024)</option>
                  <option value="openai-low-portrait">GPT Image 1 Low - Portrait (1024x1536)</option>
                </optgroup>
                <optgroup label="OpenAI GPT Image 1 - Medium Quality (1 credit)">
                  <option value="openai-medium-square">GPT Image 1 Medium - Square (1024x1024)</option>
                  <option value="openai-medium-landscape">GPT Image 1 Medium - Landscape (1536x1024)</option>
                  <option value="openai-medium-portrait">GPT Image 1 Medium - Portrait (1024x1536)</option>
                </optgroup>
                <optgroup label="OpenAI GPT Image 1 - High Quality (7 credits)">
                  <option value="openai-high-square">GPT Image 1 High - Square (1024x1024)</option>
                  <option value="openai-high-landscape">GPT Image 1 High - Landscape (1536x1024)</option>
                  <option value="openai-high-portrait">GPT Image 1 High - Portrait (1024x1536)</option>
                </optgroup>
              </select>
              
              <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
                Prompt
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  model === 'seedream' 
                    ? "Describe clothing, accessories, or styling changes (e.g., 'Dress the model in elegant evening wear')"
                    : "Describe how you want to transform these images into an advertisement..."
                }
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                {model === 'seedream' 
                  ? "SeedDream v4 specializes in fashion and clothing editing with ultra high-quality 4K output"
                  : model?.startsWith('openai-')
                  ? (() => {
                      const parts = model.split('-');
                      const quality = parts[1] || 'low';
                      const aspect = parts[2] || 'square';
                      const credits = quality === 'low' ? '0.5' : quality === 'medium' ? '1' : '7';
                      const resolution = quality === 'low' || quality === 'medium' || quality === 'high' 
                        ? (aspect === 'square' ? '1024x1024' : aspect === 'landscape' ? '1536x1024' : '1024x1536')
                        : '1024x1024';
                      return `OpenAI GPT Image 1 ${quality.charAt(0).toUpperCase() + quality.slice(1)} Quality ${aspect.charAt(0).toUpperCase() + aspect.slice(1)} (${resolution}) - ${credits} credits`;
                    })()
                  : "Gemini provides fast general-purpose image editing with multiple variations"
                }
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={generateAd}
                disabled={!prompt.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Generate (1 credit)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ImageCard({ 
  image, 
  isSelected,
  onToggleSelect, 
  getImageUrl 
}: { 
  image: Image
  isSelected: boolean
  onToggleSelect: () => void
  getImageUrl: (image: Image) => Promise<string | undefined>
}) {
  const [imageUrl, setImageUrl] = useState<string>()

  useEffect(() => {
    getImageUrl(image).then(setImageUrl)
  }, [image, getImageUrl])

  return (
    <div 
      className={`bg-white rounded-lg shadow border-2 cursor-pointer transition-all ${
        isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={onToggleSelect}
    >
      <div className="relative aspect-w-16 aspect-h-9">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={image.original_name}
            className="w-full h-48 object-cover rounded-t-lg"
          />
        )}
        <div className="absolute top-2 right-2">
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
            isSelected 
              ? 'bg-blue-600 border-blue-600' 
              : 'bg-white border-gray-300'
          }`}>
            {isSelected && (
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-900 truncate">
          {image.original_name}
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          {new Date(image.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  )
}

function JobCard({ job, onEnhance, enhancementStatus }: { 
  job: Job & { result_signed_url?: string }, 
  onEnhance?: (jobId: string, imageUrl: string) => void,
  enhancementStatus?: Record<string, string>
}) {
  const [isEnhancing, setIsEnhancing] = useState(false)
  const currentEnhancementStatus = enhancementStatus?.[job.id]
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100'
      case 'processing':
        return 'text-yellow-600 bg-yellow-100'
      case 'failed':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const handleEnhance = async () => {
    if (!job.result_signed_url || !onEnhance) return
    
    setIsEnhancing(true)
    try {
      await onEnhance(job.id, job.result_signed_url)
    } finally {
      setIsEnhancing(false)
    }
  }

  const getEnhanceButtonText = () => {
    if (isEnhancing || currentEnhancementStatus === 'enhancing') return 'Enhancing...'
    if (currentEnhancementStatus === 'completed') return '✅ Enhanced'
    if (currentEnhancementStatus === 'failed') return '❌ Retry Enhance'
    return '✨ Enhance'
  }

  const isEnhanceDisabled = () => {
    return isEnhancing || currentEnhancementStatus === 'enhancing'
  }

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex-1">
        <div className="flex items-center space-x-3">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(job.status)}`}>
            {job.status}
          </span>
          <span className="text-sm text-gray-900">
            Job #{job.id.slice(0, 8)}
          </span>
          <span className="text-xs text-gray-500">
            {new Date(job.created_at).toLocaleString()}
          </span>
        </div>
        {job.error_message && (
          <p className="text-sm text-red-600 mt-1">{job.error_message}</p>
        )}
      </div>
      {job.status === 'completed' && job.result_signed_url && (
        <div className="flex items-center space-x-3">
          <a
            href={job.result_signed_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            View Result
          </a>
          {onEnhance && (
            <button
              onClick={handleEnhance}
              disabled={isEnhanceDisabled()}
              className={`px-3 py-1 text-xs font-medium text-white rounded transition-colors ${
                currentEnhancementStatus === 'completed' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : currentEnhancementStatus === 'failed'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-purple-600 hover:bg-purple-700'
              } disabled:bg-gray-400 disabled:cursor-not-allowed`}
              title={
                currentEnhancementStatus === 'completed' 
                  ? 'Image was enhanced successfully' 
                  : 'Enhance image quality and resolution using AI'
              }
            >
              {getEnhanceButtonText()}
            </button>
          )}
        </div>
      )}
    </div>
  )
}