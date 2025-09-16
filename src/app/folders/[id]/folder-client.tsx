'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
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
  const [generatedAds, setGeneratedAds] = useState<{ id: string; url: string; job_id: string; created_at: string; name?: string }[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedImage, setSelectedImage] = useState<string>('')
  const [prompt, setPrompt] = useState('')
  const [jobName, setJobName] = useState('')
  const [outputAmount, setOutputAmount] = useState(1)
  const [aspectRatio, setAspectRatio] = useState('square')
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showDeleteFolderModal, setShowDeleteFolderModal] = useState(false)
  const [imageToDelete, setImageToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [enhancementStatus, setEnhancementStatus] = useState<Record<string, string>>({})
  const [enhancedImages, setEnhancedImages] = useState<Record<string, string>>({})
  const [renamingJob, setRenamingJob] = useState<string | null>(null)
  const [newJobName, setNewJobName] = useState('')
  const [renamingAd, setRenamingAd] = useState<string | null>(null)
  const [newAdName, setNewAdName] = useState('')
  const [jobNames, setJobNames] = useState<Record<string, string>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest')
  const supabase = createClient()
  const router = useRouter()

  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetch(`/api/jobs?folder_id=${folder.id}`)
      if (response.ok) {
        const { jobs } = await response.json()
        setJobs(jobs)
        
        // Initialize jobNames from custom_name field in database
        const initialJobNames: Record<string, string> = {}
        jobs.forEach((job: Job) => {
          if (job.custom_name) {
            initialJobNames[job.id] = job.custom_name
          }
        })
        setJobNames(initialJobNames)
      }
    } catch (error) {
      console.error('Error fetching jobs:', error)
    }
  }, [folder.id])

  const fetchGeneratedAds = useCallback(async () => {
    try {
      const response = await fetch(`/api/generated-ads?folder_id=${folder.id}`)
      if (response.ok) {
        const { generatedAds } = await response.json()
        setGeneratedAds(generatedAds || [])
      }
    } catch (error) {
      console.error('Error fetching generated ads:', error)
    }
  }, [folder.id])

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
          // Also fetch generated ads when jobs change
          fetchGeneratedAds()
        }
      )
      .subscribe()

    fetchJobs()
    fetchGeneratedAds()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user.id, supabase, fetchJobs])

  const getImageUrl = useCallback(async (image: Image): Promise<string> => {
    try {
      // First try to get signed URL from uploads bucket
      const { data, error } = await supabase.storage
        .from('uploads')
        .createSignedUrl(image.file_path, 3600)
      
      if (data?.signedUrl) {
        return data.signedUrl
      }
      
      // Fallback to public URL if signed URL fails
      const { data: publicUrl } = supabase.storage
        .from('uploads')
        .getPublicUrl(image.file_path)
      
      return publicUrl?.publicUrl || ''
    } catch (error) {
      console.error('Error getting image URL:', error)
      return ''
    }
  }, [supabase])

  const handleDeleteImage = async () => {
    if (!imageToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/images/${imageToDelete}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setImages(images.filter(img => img.id !== imageToDelete))
        // If the deleted image was selected, clear the selection
        if (selectedImage === imageToDelete) {
          setSelectedImage('')
        }
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
          throw new Error('Failed to get upload URL')
        }

        const { uploadUrl, filePath, fileName } = await uploadResponse.json()

        // Upload file to Supabase Storage
        const uploadFileResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        })

        if (!uploadFileResponse.ok) {
          throw new Error('Failed to upload file')
        }

        // Create image record in database
        const { data: imageRecord, error: dbError } = await supabase
          .from('images')
          .insert({
            user_id: user.id,
            folder_id: folder.id,
            file_path: filePath,
            original_name: file.name,
            file_size: file.size,
            mime_type: file.type,
          })
          .select()
          .single()

        if (dbError || !imageRecord) {
          console.error('Failed to create image record:', dbError)
          throw new Error('Failed to save image record')
        }

        uploadedImages.push(imageRecord)
      }

      // Add new images to the end of the existing images array
      setImages([...images, ...uploadedImages])
      setUploadProgress(100)
    } catch (error) {
      console.error('Error uploading files:', error)
      alert('Failed to upload files')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
      // Reset the file input
      e.target.value = ''
    }
  }

  const handleGenerateAd = async () => {
    if (!selectedImage || !prompt.trim()) {
      if (!selectedImage) {
        alert('Please select an image')
      } else {
        alert('Please enter a prompt')
      }
      return
    }

    try {
      // Construct the model string with openai-medium + aspect ratio
      const model = `openai-medium-${aspectRatio}`
      
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_ids: [selectedImage], // Convert single image to array for API
          prompt: prompt.trim(),
          model: model,
          output_amount: 1,
          aspect_ratio: aspectRatio,
          custom_name: jobName.trim() || null, // Include job name if provided
        }),
      })

      if (response.ok) {
        const { job } = await response.json()
        setJobs([job, ...jobs])
        setShowGenerateModal(false)
        setSelectedImage('') // Clear selected image
        setPrompt('')
        setJobName('')
        setAspectRatio('square')
        alert('Ad generation started! You will see the results here when complete.')
      } else {
        const errorData = await response.json()
        alert(`Failed to start generation: ${errorData.error}`)
      }
    } catch (error) {
      console.error('Error generating ad:', error)
      alert('Failed to start generation')
    }
  }

  const handleJobRename = async (jobId: string, newName: string) => {
    if (!newName.trim()) return

    try {
      const response = await fetch(`/api/jobs/${jobId}/rename`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customName: newName.trim(),
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.success) {
        // Store the custom name in local state for immediate UI update
        setJobNames(prev => ({ 
          ...prev, 
          [jobId]: newName.trim() 
        }))
        
        // Reset renaming state
        setRenamingJob(null)
        setNewJobName('')
        
        console.log(`Job ${jobId} renamed to: ${newName.trim()}`)
      } else {
        throw new Error(result.error || 'Failed to rename job')
      }
    } catch (error) {
      console.error('Error renaming job:', error)
      alert(`Failed to rename ad: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleRenameAd = async (adId: string, newName: string) => {
    if (!newName.trim()) return

    try {
      const response = await fetch(`/api/generated-ads/${adId}/rename-metadata`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newName.trim(),
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.success) {
        // Update the generated ad name in local state
        setGeneratedAds(prev => prev.map(ad => 
          ad.id === adId ? { ...ad, name: newName.trim() } : ad
        ))
        
        // Reset renaming state
        setRenamingAd(null)
        setNewAdName('')
        
        console.log(`Generated ad ${adId} renamed to: ${newName.trim()}`)
      } else {
        throw new Error(result.error || 'Failed to rename generated ad')
      }
    } catch (error) {
      console.error('Error renaming generated ad:', error)
      alert(`Failed to rename generated ad: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleEnhance = async (jobId: string, imageUrl: string) => {
    setEnhancementStatus(prev => ({ ...prev, [jobId]: 'enhancing' }))
    
    try {
      const response = await fetch('/api/enhance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          jobId,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.success && result.enhancedImageUrl) {
        setEnhancementStatus(prev => ({ ...prev, [jobId]: 'completed' }))
        setEnhancedImages(prev => ({ ...prev, [jobId]: result.enhancedImageUrl }))
        
        alert('🎉 Image enhanced successfully! Click the green checkmark to view the enhanced version.')
      } else {
        throw new Error(result.error || 'Failed to enhance image')
      }
    } catch (error) {
      console.error('Enhancement error:', error)
      setEnhancementStatus(prev => ({ ...prev, [jobId]: 'failed' }))
      alert(`❌ Enhancement failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
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

        {/* Upload section - only show when images exist */}
        {images.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 mb-8 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Upload More Images</h2>
              <p className="text-sm text-gray-600 mt-1">Add additional images to your folder</p>
            </div>
            
            <div className="p-6">
              <label htmlFor="file-upload" className="cursor-pointer block">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-blue-400 transition-colors duration-200">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <span className="text-lg font-medium text-gray-900 block mb-2">
                      {isUploading ? `Uploading... ${uploadProgress.toFixed(0)}%` : 'Upload More Images'}
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
              </label>
            </div>
          </div>
        )}

        {/* Images section */}
        {images.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 mb-8 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Your Images</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Select one image to generate an ad {selectedImage && '• 1 image selected'}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setSelectedImage('')}
                    className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    disabled={!selectedImage}
                  >
                    Clear Selection
                  </button>
                  {selectedImage && (
                    <button
                      onClick={() => setShowGenerateModal(true)}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg shadow-blue-500/20"
                    >
                      Generate Ad
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {images.filter(image => image?.id).map((image) => (
                  <ImageCard
                    key={image.id}
                    image={image}
                    isSelected={selectedImage === image.id}
                    onToggleSelect={() => {
                      // If clicking the already selected image, deselect it
                      if (selectedImage === image.id) {
                        setSelectedImage('')
                      } else {
                        // Otherwise, select this image (replacing any previous selection)
                        setSelectedImage(image.id)
                      }
                    }}
                    onDelete={() => {
                      setImageToDelete(image.id)
                      setShowDeleteModal(true)
                    }}
                    getImageUrl={getImageUrl}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Generated Ads section */}
        {generatedAds.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Generated Ads</h2>
                  <p className="text-sm text-gray-600 mt-1">View and manage your AI-generated advertisements</p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search ads..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'name')}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="name">By Name</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              {(() => {
                const filteredAds = generatedAds
                  .filter(ad => 
                    (ad.name || '').toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .sort((a, b) => {
                    switch (sortBy) {
                      case 'oldest':
                        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                      case 'name':
                        return (a.name || '').localeCompare(b.name || '');
                      case 'newest':
                      default:
                        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                    }
                  });

                if (filteredAds.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <div className="text-gray-400 mb-2">
                        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <p className="text-gray-500">No ads found matching &ldquo;{searchTerm}&rdquo;</p>
                      <p className="text-sm text-gray-400 mt-1">Try adjusting your search terms</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredAds.map((ad) => (
                    <div key={ad.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <div className="aspect-square bg-white rounded-lg overflow-hidden mb-3">
                        <img
                          src={ad.url}
                          alt={ad.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="space-y-2">
                        {renamingAd === ad.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={newAdName}
                              onChange={(e) => setNewAdName(e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleRenameAd(ad.id, newAdName)
                                } else if (e.key === 'Escape') {
                                  setRenamingAd(null)
                                  setNewAdName('')
                                }
                              }}
                              autoFocus
                            />
                            <div className="flex space-x-1">
                              <button
                                onClick={() => handleRenameAd(ad.id, newAdName)}
                                className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setRenamingAd(null)
                                  setNewAdName('')
                                }}
                                className="px-2 py-1 bg-gray-400 text-white text-xs rounded hover:bg-gray-500"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <h4 className="font-medium text-gray-900 text-sm truncate">{ad.name}</h4>
                            <p className="text-xs text-gray-500">
                              {new Date(ad.created_at).toLocaleDateString()}
                            </p>
                          </>
                        )}
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setRenamingAd(ad.id)
                              setNewAdName(ad.name || '')
                            }}
                            className="flex-1 bg-gray-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors text-center"
                          >
                            Rename
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const response = await fetch(ad.url)
                                const blob = await response.blob()
                                const url = window.URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url
                                a.download = `${ad.name || `generated-ad-${ad.id.slice(0, 8)}`}.png`
                                document.body.appendChild(a)
                                a.click()
                                window.URL.revokeObjectURL(url)
                                document.body.removeChild(a)
                              } catch (error) {
                                console.error('Download failed:', error)
                                alert('Download failed. Please try again.')
                              }
                            }}
                            className="flex-1 bg-blue-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors text-center"
                          >
                            Download
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                );
              })()}
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

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Generate Ad</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Create a professional ad from your selected image
                  </p>
                </div>
                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                {/* Selected Image Preview */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Selected Image
                  </label>
                  {selectedImage ? (
                    <div className="grid grid-cols-1 gap-3">
                      {(() => {
                        const image = images.find(img => img?.id === selectedImage)
                        if (!image) return null
                        
                        return (
                          <GenerateModalImageCard
                            key={selectedImage}
                            image={image}
                            onRemove={() => {
                              setSelectedImage('')
                            }}
                            getImageUrl={getImageUrl}
                          />
                        )
                      })()}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p>No image selected</p>
                      <p className="text-xs mt-1">Close this modal and select an image to continue</p>
                    </div>
                  )}
                </div>

                {/* Job Name Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ad Name (optional)
                  </label>
                  <input
                    type="text"
                    value={jobName}
                    onChange={(e) => setJobName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., Product Launch Ad, Summer Campaign..."
                  />
                </div>

                {/* Prompt Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    What ad would you like to create?
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    rows={3}
                    placeholder="Describe the ad you want to create..."
                  />
                </div>

                {/* Aspect Ratio Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Aspect Ratio
                  </label>
                  <div className="flex space-x-4">
                    <button
                      type="button"
                      onClick={() => setAspectRatio('square')}
                      className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all duration-200 ${
                        aspectRatio === 'square'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 hover:border-gray-400 text-gray-700'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded border-2 mb-2 ${
                        aspectRatio === 'square' ? 'border-blue-500 bg-blue-100' : 'border-gray-400 bg-gray-100'
                      }`}></div>
                      <span className="text-sm font-medium">Square</span>
                      <span className="text-xs text-gray-500">1:1</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAspectRatio('portrait')}
                      className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all duration-200 ${
                        aspectRatio === 'portrait'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 hover:border-gray-400 text-gray-700'
                      }`}
                    >
                      <div className={`w-6 h-8 rounded border-2 mb-2 ${
                        aspectRatio === 'portrait' ? 'border-blue-500 bg-blue-100' : 'border-gray-400 bg-gray-100'
                      }`}></div>
                      <span className="text-sm font-medium">Portrait</span>
                      <span className="text-xs text-gray-500">3:4</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAspectRatio('landscape')}
                      className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all duration-200 ${
                        aspectRatio === 'landscape'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 hover:border-gray-400 text-gray-700'
                      }`}
                    >
                      <div className={`w-8 h-6 rounded border-2 mb-2 ${
                        aspectRatio === 'landscape' ? 'border-blue-500 bg-blue-100' : 'border-gray-400 bg-gray-100'
                      }`}></div>
                      <span className="text-sm font-medium">Landscape</span>
                      <span className="text-xs text-gray-500">4:3</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  {selectedImage ? (
                    <div>
                      <span>Ready to generate 1 ad from your selected image</span>
                      <div className="text-xs text-gray-500 mt-1">
                        Cost: 1 credit
                      </div>
                    </div>
                  ) : (
                    <span className="text-red-600">Please select an image</span>
                  )}
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowGenerateModal(false)}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerateAd}
                    disabled={!prompt.trim() || !selectedImage}
                    className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-500/20"
                  >
                    Generate Ad
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                Are you sure you want to delete &quot;{folder.name}&quot;? This will permanently remove the folder and all its images. This action cannot be undone.
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
    </DashboardLayout>
  )
}

// Image Card Component
function ImageCard({ 
  image, 
  isSelected, 
  onToggleSelect, 
  onDelete, 
  getImageUrl
}: { 
  image: Image
  isSelected: boolean
  onToggleSelect: () => void
  onDelete: () => void
  getImageUrl: (image: Image) => Promise<string>
}) {
  const [imageUrl, setImageUrl] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  // Memoize the image URL to prevent unnecessary fetches
  const cachedImageUrl = useMemo(() => {
    if (imageUrl) return imageUrl
    return ''
  }, [imageUrl])

  useEffect(() => {
    let isMounted = true
    
    setIsLoading(true)
    setHasError(false)
    
    getImageUrl(image)
      .then((url) => {
        if (isMounted) {
          setImageUrl(url)
          setIsLoading(false)
        }
      })
      .catch((error) => {
        if (isMounted) {
          console.error('Failed to load image URL:', error)
          setHasError(true)
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [image.file_path, getImageUrl]) // Only depend on file_path and the memoized function

  return (
    <div
      className={`relative rounded-xl border-2 transition-all duration-200 cursor-pointer group ${
        isSelected 
          ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-lg shadow-blue-100' 
          : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={onToggleSelect}
    >
      <div className="relative aspect-square bg-gray-100 rounded-t-xl overflow-hidden">
        {isLoading && (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        )}
        
        {!isLoading && hasError && (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-xs text-gray-500">Failed to load</p>
            </div>
          </div>
        )}
        
        {!isLoading && !hasError && imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={image.original_name}
            className="w-full h-full object-cover"
            onError={() => setHasError(true)}
          />
        )}
        
        <div className="absolute top-2 right-2 flex space-x-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-700"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
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
      <div className="p-3">
        <h3 className="text-sm font-medium text-gray-900 truncate">
          {image.original_name}
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          {new Date(image.created_at).toLocaleDateString('en-US')}
        </p>
      </div>
    </div>
  )
}

// Job Card Component
function JobCard({ 
  job, 
  onEnhance, 
  enhancementStatus, 
  enhancedImages,
  onRename,
  renamingJob,
  setRenamingJob,
  newJobName,
  setNewJobName,
  jobNames
}: { 
  job: Job & { result_signed_url?: string }, 
  onEnhance?: (jobId: string, imageUrl: string) => void,
  enhancementStatus?: Record<string, string>,
  enhancedImages?: Record<string, string>,
  onRename?: (jobId: string, newName: string) => void,
  renamingJob?: string | null,
  setRenamingJob?: (id: string | null) => void,
  newJobName?: string,
  setNewJobName?: (name: string) => void,
  jobNames?: Record<string, string>
}) {
  const [isEnhancing, setIsEnhancing] = useState(false)
  const currentEnhancementStatus = enhancementStatus?.[job.id]
  
  // Get the display name for this job
  const displayName = jobNames?.[job.id] || `Ad #${job.id.slice(0, 8)}`
  const isCurrentlyRenaming = renamingJob === job.id
  
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

  const handleDownload = async () => {
    if (!job.result_signed_url) return
    
    try {
      const response = await fetch(job.result_signed_url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `generated-ad-${job.id.slice(0, 8)}.jpg`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Download failed:', error)
      alert('Download failed. Please try again.')
    }
  }

  const isEnhanceDisabled = () => {
    return isEnhancing || currentEnhancementStatus === 'enhancing'
  }

  return (
    <div className="relative rounded-xl border-2 border-gray-200 hover:border-gray-300 transition-all duration-200 cursor-pointer group bg-white">
      <div className="relative aspect-square bg-gray-100 rounded-t-xl overflow-hidden">
        {job.status === 'completed' && job.result_signed_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={job.result_signed_url}
              alt={`Generated ad ${job.id.slice(0, 8)}`}
              className="w-full h-full object-cover"
              onClick={() => window.open(job.result_signed_url, '_blank')}
            />
            {/* Action buttons overlay - Always visible */}
            <div className="absolute bottom-2 right-2 flex space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (setRenamingJob && setNewJobName) {
                    setRenamingJob(job.id)
                    setNewJobName(displayName)
                  }
                }}
                className="p-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-colors duration-200"
                title="Rename"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDownload()
                }}
                className="p-2 bg-green-600 text-white rounded-lg shadow-lg hover:bg-green-700 transition-colors duration-200"
                title="Download"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              {onEnhance && currentEnhancementStatus !== 'completed' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEnhance()
                  }}
                  disabled={isEnhanceDisabled()}
                  className={`p-2 text-white rounded-lg shadow-lg transition-colors duration-200 ${
                    currentEnhancementStatus === 'failed'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-purple-600 hover:bg-purple-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={
                    currentEnhancementStatus === 'failed'
                      ? 'Enhancement failed - Try again'
                      : currentEnhancementStatus === 'enhancing'
                      ? 'Enhancing...'
                      : 'Enhance quality'
                  }
                >
                  {currentEnhancementStatus === 'enhancing' ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : currentEnhancementStatus === 'failed' ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  )}
                </button>
              )}
            </div>
            {/* Status badge */}
            <div className="absolute top-2 left-2">
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(job.status)}`}>
                {job.status}
              </span>
            </div>
          </>
        ) : job.status === 'processing' ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-yellow-300 border-t-yellow-600 rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-xs text-gray-500">Generating...</p>
            </div>
          </div>
        ) : job.status === 'failed' ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <svg className="w-8 h-8 text-red-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-red-500">Failed</p>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-gray-500">Queued</p>
            </div>
          </div>
        )}
      </div>
      
      <div className="p-3">
        {isCurrentlyRenaming ? (
          <div className="space-y-2">
            <input
              type="text"
              value={newJobName || displayName}
              onChange={(e) => setNewJobName?.(e.target.value)}
              className="w-full text-sm font-medium text-gray-900 bg-transparent border border-blue-500 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (onRename && newJobName?.trim()) {
                    onRename(job.id, newJobName)
                  }
                } else if (e.key === 'Escape') {
                  setRenamingJob?.(null)
                  setNewJobName?.('')
                }
              }}
              onBlur={() => {
                if (newJobName?.trim() && onRename) {
                  onRename(job.id, newJobName)
                } else {
                  setRenamingJob?.(null)
                }
              }}
              autoFocus
            />
            <div className="flex space-x-1">
              <button
                onClick={() => {
                  if (onRename && newJobName?.trim()) {
                    onRename(job.id, newJobName)
                  }
                }}
                className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setRenamingJob?.(null)
                  setNewJobName?.('')
                }}
                className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {displayName}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {new Date(job.created_at).toLocaleDateString('en-US')}
            </p>
            {job.error_message && (
              <p className="text-xs text-red-500 mt-1 truncate" title={job.error_message}>
                {job.error_message}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Generate Modal Image Card Component
function GenerateModalImageCard({ 
  image, 
  onRemove, 
  getImageUrl 
}: { 
  image: Image
  onRemove: () => void
  getImageUrl: (image: Image) => Promise<string>
}) {
  const [imageUrl, setImageUrl] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let isMounted = true
    
    setIsLoading(true)
    setHasError(false)
    
    getImageUrl(image)
      .then((url) => {
        if (isMounted) {
          setImageUrl(url)
          setIsLoading(false)
        }
      })
      .catch((error) => {
        if (isMounted) {
          console.error('Failed to load image URL:', error)
          setHasError(true)
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [image.file_path, getImageUrl]) // Only depend on file_path and the memoized function

  return (
    <div className="relative rounded-lg border border-gray-200 overflow-hidden group bg-white">
      <div className="relative aspect-square bg-gray-100">
        {isLoading && (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        )}
        
        {!isLoading && hasError && (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        
        {!isLoading && !hasError && imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={image.original_name}
            className="w-full h-full object-cover"
            onError={() => setHasError(true)}
          />
        )}
        
        {/* Remove button */}
        <button
          onClick={onRemove}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-700 flex items-center justify-center shadow-lg"
          title="Remove image"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        {/* Selected indicator */}
        <div className="absolute top-1 left-1">
          <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>
      
      <div className="p-2">
        <p className="text-xs text-gray-600 truncate" title={image.original_name}>
          {image.original_name}
        </p>
      </div>
    </div>
  )
}