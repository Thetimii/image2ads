'use client'

import { useEffect, useState } from 'react'
import { useSupabaseUser } from '@/hooks/useSupabaseUser'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

interface Job {
  id: string
  prompt: string
  result_url: string | null
  result_type: 'image' | 'video' | 'music'
  status: string
  created_at: string
  error_message?: string
  cover_url?: string | null
  lyrics?: string | null
}

interface ChatHistoryProps {
  jobType: 'text-to-image' | 'image-to-image' | 'text-to-video' | 'image-to-video' | 'text-to-music'
}

export default function ChatHistory({ jobType }: ChatHistoryProps) {
  const supabase = createClient()
  const { user, loading: userLoading } = useSupabaseUser()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (userLoading) return
    if (!user) {
      setError('No user signed in')
      setLoading(false)
      return
    }

    const loadJobs = async () => {
      try {
        setLoading(true)
        setError(null)

        console.log(`🔍 Loading jobs for tab: ${jobType}, user: ${user.id}`)

        // Query jobs table - map jobType to database filters
        // Based on your existing logic, jobs are differentiated by has_images + result_type
        let query = supabase
          .from('jobs')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20) // Limit for performance

        // Apply filters based on jobType
        if (jobType === 'text-to-image') {
          query = query.eq('has_images', false).eq('result_type', 'image')
        } else if (jobType === 'image-to-image') {
          query = query.eq('has_images', true).eq('result_type', 'image')
        } else if (jobType === 'text-to-video') {
          query = query.eq('has_images', false).eq('result_type', 'video')
        } else if (jobType === 'image-to-video') {
          query = query.eq('has_images', true).eq('result_type', 'video')
        }

        const { data, error: queryError } = await query

        if (queryError) throw queryError

        console.log(`✅ Loaded ${data?.length || 0} jobs for ${jobType}`)
        setJobs(data || [])

        // Set up realtime subscription for new jobs
        const channel = supabase
          .channel(`jobs-${jobType}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'jobs',
            filter: `user_id=eq.${user.id}`
          }, (payload) => {
            const newJob = payload.new as Job
            console.log(`🔔 New job inserted:`, newJob)
            
            // Check if this job belongs to current tab
            const belongsToCurrentTab = 
              (jobType === 'text-to-image' && !newJob.result_url && newJob.result_type === 'image') ||
              (jobType === 'image-to-image' && newJob.result_url && newJob.result_type === 'image') ||
              (jobType === 'text-to-video' && !newJob.result_url && newJob.result_type === 'video') ||
              (jobType === 'image-to-video' && newJob.result_url && newJob.result_type === 'video')

            if (belongsToCurrentTab) {
              setJobs(prev => [newJob, ...prev])
            }
          })
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'jobs',
            filter: `user_id=eq.${user.id}`
          }, (payload) => {
            const updatedJob = payload.new as Job
            console.log(`📝 Job updated:`, updatedJob)
            
            setJobs(prev => prev.map(job => 
              job.id === updatedJob.id ? updatedJob : job
            ))
          })
          .subscribe()

        return () => {
          supabase.removeChannel(channel)
        }

      } catch (err: any) {
        console.error(`Error loading jobs for ${jobType}:`, err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    const cleanup = loadJobs()
    return () => {
      cleanup?.then(fn => fn?.())
    }
  }, [jobType, user, userLoading]) // Refetch when jobType or user changes

  const getSignedUrl = async (job: Job) => {
    if (!job.result_url) return null
    
    try {
      const { data } = await supabase.storage
        .from('results')
        .createSignedUrl(job.result_url, 3600)
      
      return data?.signedUrl || null
    } catch (error) {
      console.error('Error getting signed URL:', error)
      return null
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-gray-500">Loading chat history...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-red-500">
          <div className="text-2xl mb-2">⚠️</div>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-4">💬</div>
          <p className="text-sm">No chat history yet.</p>
          <p className="text-xs mt-1">Start by creating your first {jobType.replace('-', ' ')}!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 h-full overflow-y-auto">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} getSignedUrl={getSignedUrl} />
      ))}
    </div>
  )
}

// Separate component for individual job cards
function JobCard({ job, getSignedUrl }: { job: Job; getSignedUrl: (job: Job) => Promise<string | null> }) {
  const supabase = createClient()
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [loadingMedia, setLoadingMedia] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (job.result_url && job.status === 'completed') {
      setLoadingMedia(true)
      getSignedUrl(job).then(url => {
        setMediaUrl(url)
        setLoadingMedia(false)
      })
      
      // Load cover URL for music
      if (job.result_type === 'music' && job.cover_url) {
        supabase.storage.from('results').createSignedUrl(job.cover_url, 3600).then(({ data }) => {
          if (data?.signedUrl) setCoverUrl(data.signedUrl)
        })
      }
    }
  }, [job.result_url, job.status, job.cover_url])

  const handleDownloadMusic = async () => {
    if (!mediaUrl || job.result_type !== 'music') return
    
    try {
      setDownloading(true)
      console.log('Starting music download...', { mediaUrl, coverUrl })
      
      // Download music file
      const audioResponse = await fetch(mediaUrl)
      const audioBlob = await audioResponse.blob()
      console.log('Audio downloaded:', audioBlob.size, 'bytes')
      
      // Download cover if available
      let coverBlob: Blob | null = null
      if (coverUrl) {
        console.log('Downloading cover from:', coverUrl)
        const coverResponse = await fetch(coverUrl)
        coverBlob = await coverResponse.blob()
        console.log('Cover downloaded:', coverBlob.size, 'bytes')
      } else {
        console.log('No cover URL available')
      }
      
      // Create ZIP file using JSZip
      console.log('Creating ZIP file...')
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      
      // Add music file
      const timestamp = new Date().getTime()
      zip.file(`music_${timestamp}.mp3`, audioBlob)
      console.log('Added music to ZIP')
      
      // Add cover if available
      if (coverBlob) {
        zip.file(`cover_${timestamp}.jpg`, coverBlob)
        console.log('Added cover to ZIP')
      }
      
      // Generate ZIP and download
      console.log('Generating ZIP...')
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      console.log('ZIP generated:', zipBlob.size, 'bytes')
      
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `music_generation_${timestamp}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      console.log('Download initiated')
    } catch (error) {
      console.error('Error downloading music:', error)
      alert('Failed to download files. Error: ' + (error as Error).message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* User Prompt */}
      <div className="flex justify-end">
        <div className="bg-purple-600 text-white rounded-2xl rounded-br-sm px-4 py-3 shadow-sm text-sm max-w-[75%]">
          <div className="whitespace-pre-wrap leading-relaxed break-words">
            {job.prompt}
          </div>
        </div>
      </div>

      {/* Assistant Response */}
      <div className="flex justify-start">
        <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm text-sm max-w-[75%]">
          {job.status === 'completed' && (
            <>
              <div className="text-gray-700 mb-3">
                {job.result_type === 'video' ? 'Video' : job.result_type === 'music' ? 'Music' : 'Image'} generated ✅
              </div>
              
              {loadingMedia ? (
                <div className="w-64 h-40 bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin"></div>
                </div>
              ) : mediaUrl ? (
                job.result_type === 'image' ? (
                  <div className="relative group">
                    <Image 
                      src={mediaUrl} 
                      alt="Generated result" 
                      width={300} 
                      height={300} 
                      className="rounded-lg cursor-pointer hover:shadow-lg transition-shadow max-w-full h-auto" 
                      onClick={() => window.open(mediaUrl, '_blank')}
                    />
                  </div>
                ) : job.result_type === 'video' ? (
                  <video 
                    src={mediaUrl} 
                    controls 
                    className="rounded-lg max-w-full h-auto shadow-md" 
                  />
                ) : job.result_type === 'music' ? (
                  <div className="space-y-3">
                    {/* Cover Image */}
                    {coverUrl && (
                      <div className="relative">
                        <Image 
                          src={coverUrl} 
                          alt="Album cover" 
                          width={300} 
                          height={300} 
                          className="rounded-lg shadow-md max-w-full h-auto" 
                        />
                      </div>
                    )}
                    
                    {/* Audio Player */}
                    <audio 
                      src={mediaUrl} 
                      controls 
                      className="w-full max-w-[300px]" 
                    />
                    
                    {/* Download Button */}
                    <button
                      onClick={handleDownloadMusic}
                      disabled={downloading}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white text-sm rounded-lg transition-colors w-full max-w-[300px] justify-center"
                    >
                      {downloading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Preparing download...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download {coverUrl ? 'Music + Cover' : 'Music'}
                        </>
                      )}
                    </button>
                  </div>
                ) : null
              ) : (
                <div className="w-64 h-40 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 text-xs">
                  Media unavailable
                </div>
              )}
            </>
          )}

          {job.status === 'failed' && (
            <div className="text-red-600">
              {job.error_message || 'Generation failed'}
            </div>
          )}

          {(job.status === 'pending' || job.status === 'processing') && (
            <>
              <div className="text-gray-600 mb-3">Generating...</div>
              <div className="w-64 h-40 rounded-lg bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 relative overflow-hidden border border-purple-200/50">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-[shimmer_2s_infinite] -translate-x-full" />
                <div className="absolute inset-0 flex items-center justify-center text-purple-600 text-sm">
                  Processing...
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}