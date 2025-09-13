'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import type { Profile, Folder, Image, Job } from '@/lib/validations'

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
  const router = useRouter()
  const supabase = createClient()

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
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

      // Upload file to Supabase storage
      const uploadResult = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      })

      if (!uploadResult.ok) {
        throw new Error('Failed to upload file')
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
        throw new Error('Failed to save image record')
      }

      setImages([imageData, ...images])
      setUploadProgress(100)
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload file. Please try again.')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const generateAd = async (imageId: string) => {
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
          image_id: imageId,
          credits_used: 1,
        }),
      })

      if (response.ok) {
        alert('Generation started! Check your jobs for progress.')
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

  const getImageUrl = async (image: Image) => {
    const { data } = await supabase.storage
      .from('uploads')
      .createSignedUrl(image.file_path, 300)
    return data?.signedUrl
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard" className="text-blue-600 hover:text-blue-800">
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">{folder.name}</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                Credits: <span className="font-semibold text-blue-600">{profile.credits}</span>
              </div>
              <Link
                href="/billing"
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
              >
                Billing
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Upload section */}
          <div className="mb-8">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="mt-4">
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <span className="mt-2 block text-sm font-medium text-gray-900">
                      {isUploading ? `Uploading... ${uploadProgress}%` : 'Upload an image'}
                    </span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      className="sr-only"
                      accept="image/*"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                    />
                  </label>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG, WEBP up to 10MB</p>
                </div>
              </div>
            </div>
          </div>

          {/* Images grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {images.map((image) => (
              <ImageCard 
                key={image.id} 
                image={image} 
                onGenerate={() => generateAd(image.id)}
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
                  <div className="space-y-4">
                    {jobs.slice(0, 10).map((job) => (
                      <JobCard key={job.id} job={job} />
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
    </div>
  )
}

function ImageCard({ 
  image, 
  onGenerate, 
  getImageUrl 
}: { 
  image: Image
  onGenerate: () => void
  getImageUrl: (image: Image) => Promise<string | undefined>
}) {
  const [imageUrl, setImageUrl] = useState<string>()

  useEffect(() => {
    getImageUrl(image).then(setImageUrl)
  }, [image, getImageUrl])

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      <div className="aspect-w-16 aspect-h-9">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={image.original_name}
            className="w-full h-48 object-cover rounded-t-lg"
          />
        )}
      </div>
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-900 truncate">
          {image.original_name}
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          {new Date(image.created_at).toLocaleDateString()}
        </p>
        <button
          onClick={onGenerate}
          className="mt-3 w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Generate Ad (1 credit)
        </button>
      </div>
    </div>
  )
}

function JobCard({ job }: { job: Job & { result_signed_url?: string } }) {
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
        <a
          href={job.result_signed_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          View Result
        </a>
      )}
    </div>
  )
}