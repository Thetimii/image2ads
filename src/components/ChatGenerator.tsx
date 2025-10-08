'use client'

import { useEffect, useRef, useState } from 'react'
import { useGenerator, ChatMessage } from '@/contexts/GeneratorContext'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/validations'

// Generate UUID that works on both server and client
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for server-side or older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c == 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

interface ChatGeneratorProps {
  user: User
  profile: Profile
  onLockedFeature?: () => void
}

// Supabase Edge Function endpoints
const SUPABASE_FUNCTIONS_BASE = 'https://cqnaooicfxqtnbuwsopu.supabase.co/functions/v1'

const ENDPOINT_MAP: Record<string, string> = {
  'text-to-image': `${SUPABASE_FUNCTIONS_BASE}/generate-text-image`,
  'image-to-image': `${SUPABASE_FUNCTIONS_BASE}/generate-image-image`,
  'text-to-video': `${SUPABASE_FUNCTIONS_BASE}/generate-text-video`,
  'image-to-video': `${SUPABASE_FUNCTIONS_BASE}/generate-image-video`,
}

const CHECK_JOB_STATUS_ENDPOINT = `${SUPABASE_FUNCTIONS_BASE}/check-job-status`

const TAB_META: Record<string, { title: string; subtitle: string; locked?: boolean; model: string; resultType: 'image' | 'video' }> = {
  'text-to-image': { title: '🖼️ Text to Image', subtitle: 'Generate product-ready visuals from ideas', model: 'gemini', resultType: 'image' },
  'image-to-image': { title: '🌅 Image to Image', subtitle: 'Transform or restyle an input image', model: 'gemini', resultType: 'image' },
  // Switch video tabs to use sora-2 (user request) instead of seedream
  'text-to-video': { title: '🎬 Text to Video', subtitle: 'Bring concepts to motion with AI video', locked: true, model: 'sora-2', resultType: 'video' },
  'image-to-video': { title: '🎥 Image to Video', subtitle: 'Animate a still into dynamic video', locked: true, model: 'sora-2', resultType: 'video' },
}

const EXAMPLES: Record<string, Array<{ short: string; full: string }>> = {
  'text-to-image': [
    {
      short: '☕ Coffee Cup on Wooden Table',
      full: 'Ultra-detailed cinematic product photo of a double-walled glass coffee mug on a wet rustic wooden counter at sunrise, shallow depth of field, soft volumetric light through foggy window, micro droplets, 50mm photography, editorial, crisp reflections'
    },
    {
      short: '💄 Skincare Bottle with Water Splash',
      full: 'Premium skincare bottle on rippled water surface, translucent gel splashes frozen mid-air, morning spa ambience, diffused natural daylight, soft muted pastel palette, luxury aesthetic, high resolution, studio macro lens'
    },
    {
      short: '🏃‍♀️ Sport Bottle in Motion',
      full: 'Dynamic sport water bottle mid-squeeze with engineered droplets suspended, stadium tunnel background with motion blur, dramatic rim lighting, energetic vibrant color grading'
    }
  ],
  'image-to-image': [
    {
      short: '🌃 Moody Cyberpunk Neon Scene',
      full: 'Restyle this into a moody cyberpunk neon scene, rain-soaked surfaces, teal and magenta glow, cinematic contrast, atmospheric haze'
    },
    {
      short: '🏔️ Minimalist Scandinavian Aesthetic',
      full: 'Transform into a minimalist Scandinavian aesthetic: soft neutral tones, gentle indirect light, matte textures, editorial clarity'
    },
    {
      short: '🏖️ Bright Summer Beach Lifestyle',
      full: 'Convert to a bright summer beach lifestyle shot with warm golden hour lighting, subtle lens flare, airy composition'
    }
  ],
  'text-to-video': [
    {
      short: '🛴 Eco Scooter Through Misty Forest',
      full: '8 second cinematic dolly shot of a futuristic eco-friendly electric scooter gliding through a misty forest trail at dawn, soft god rays, particles in air, natural color grading, smooth motion, 4K film look'
    },
    {
      short: '🌸 Perfume Bottle with Silk Fabric',
      full: 'Slow rotating hero shot of a luxury perfume bottle emerging from swirling translucent silk fabric, macro lens depth, sparkling dust motes, dramatic lighting shifts'
    },
    {
      short: '🌊 Aerial Coastline with Waves',
      full: 'Dynamic aerial push-in over rugged coastline with powerful turquoise waves crashing, seagulls crossing frame, cinematic stabilization, crisp atmospheric depth'
    }
  ],
  'image-to-video': [
    {
      short: '✨ Parallax Depth Reveal',
      full: 'Animate into a subtle 6s parallax reveal: foreground lifts gently, depth layers move at different speeds, soft ambient particles, cinematic ease in-out'
    },
    {
      short: '🔄 Rotating Hero Product Motion',
      full: 'Create a seamless looping rotation with gentle perspective shift, premium product hero motion, soft ambient studio light transitions'
    },
    {
      short: '🌫️ Atmospheric Fog & Light Motion',
      full: 'Add dynamic atmospheric motion: drifting fog layers, gentle light shifts, subtle camera push forward, premium film tone'
    }
  ]
}

export default function ChatGenerator({ user, profile, onLockedFeature }: ChatGeneratorProps) {
  const gen = useGenerator()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [localFile, setLocalFile] = useState<File | null>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const activeTimeouts = useRef<Set<NodeJS.Timeout>>(new Set())
  const activePolling = useRef<Set<string>>(new Set()) // Track active polling jobs
  const isLoadingJobs = useRef(false) // Prevent concurrent job loads
  const hasLoadedOnce = useRef(false) // Track if we've loaded jobs at least once
  const [isMounted, setIsMounted] = useState(false) // Client-side only flag

  const meta = TAB_META[gen.activeTab]
  const history = gen.histories[gen.activeTab]
  const requiresImage = gen.activeTab === 'image-to-image' || gen.activeTab === 'image-to-video'
  // Check if feature is locked: only locked if marked as locked AND user doesn't have stripe customer ID
  const isLocked = !!meta.locked && !profile?.stripe_customer_id
  
  // Client-side only to prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    // Use setTimeout to ensure DOM has updated
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, 100)
  }, [history.length])

  // Cleanup timeouts on unmount or user change
  useEffect(() => {
    return () => {
      // Clear all active timeouts when component unmounts
      activeTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId))
      activeTimeouts.current.clear()
    }
  }, [])

  // Clear timeouts when user changes
  useEffect(() => {
    activeTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId))
    activeTimeouts.current.clear()
  }, [user.id])

  // Load and poll jobs from database - this is the source of truth
  useEffect(() => {
    const loadAndPollJobs = async () => {
      // Prevent concurrent loads
      if (isLoadingJobs.current) {
        console.log('⏭️ Skipping job load - already loading')
        return
      }
      
      // Only load once per session (prevents hot reload from loading multiple times)
      if (hasLoadedOnce.current) {
        console.log('⏭️ Skipping job load - already loaded once')
        return
      }
      
      isLoadingJobs.current = true
      const startTime = performance.now()
      try {
        console.log('Loading jobs from database...')
        // Get only recent jobs (last 10) to speed up initial load
        const { data: jobs, error } = await supabase
          .from('jobs')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10)

        console.log(`⏱️ Jobs query took ${(performance.now() - startTime).toFixed(0)}ms`)

        if (error) {
          console.error('Error loading jobs:', error)
          return
        }

        if (!jobs || jobs.length === 0) {
          console.log('No jobs found')
          hasLoadedOnce.current = true // Only set this on success
          return
        }

        // Reverse to get chronological order
        jobs.reverse()

        console.log(`Found ${jobs.length} jobs:`, jobs)

        // Convert jobs to chat messages and organize by type
        const jobsByType: Record<keyof typeof gen.histories, any[]> = {
          'text-to-image': [],
          'image-to-image': [],
          'text-to-video': [],
          'image-to-video': []
        }

        // Group jobs by result type
        jobs.forEach(job => {
          const tabKey = job.has_images 
            ? (job.result_type === 'video' ? 'image-to-video' : 'image-to-image')
            : (job.result_type === 'video' ? 'text-to-video' : 'text-to-image')
          
          jobsByType[tabKey].push(job)
        })

        // Batch fetch all signed URLs for completed jobs
        const urlFetchStart = performance.now()
        const completedJobs = jobs.filter(job => job.status === 'completed' && job.result_url)
        console.log(`📦 Fetching ${completedJobs.length} signed URLs in parallel...`)
        const signedUrlPromises = completedJobs.map(job => 
          supabase.storage
            .from('results')
            .createSignedUrl(job.result_url, 3600)
            .then(result => ({ jobId: job.id, signedUrl: result.data?.signedUrl }))
            .catch(err => {
              console.error(`Error getting signed URL for job ${job.id}:`, err)
              return { jobId: job.id, signedUrl: null }
            })
        )
        
        const signedUrlResults = await Promise.all(signedUrlPromises)
        console.log(`⏱️ Signed URLs fetched in ${(performance.now() - urlFetchStart).toFixed(0)}ms`)
        const signedUrlMap = new Map(
          signedUrlResults
            .filter(result => result.signedUrl)
            .map(result => [result.jobId, result.signedUrl])
        )

        // Update histories with jobs converted to messages
        Object.entries(jobsByType).forEach(([tab, tabJobs]) => {
          const tabKey = tab as keyof typeof gen.histories
          const existingMessages = gen.histories[tabKey]
          
          tabJobs.forEach(job => {
            const alreadyHasAssistant = existingMessages.some(m => m.jobId === job.id && m.role === 'assistant')
            const alreadyHasUser = existingMessages.some(m => m.id === `user-${job.id}`)
            // Only add messages if they don't exist
            if (!alreadyHasUser) {
            // Add user message
            const userMessage: ChatMessage = {
              id: `user-${job.id}`,
              role: 'user',
              content: job.prompt,
              createdAt: new Date(job.created_at).getTime()
            }
              gen.pushMessage(tabKey, userMessage)
            }

            let assistantMessage: ChatMessage | undefined
            if (!alreadyHasAssistant) {
              assistantMessage = {
                id: `assistant-${job.id}`,
                role: 'assistant',
                content: job.status === 'completed' ? `${job.result_type === 'video' ? 'Video' : 'Image'} generated ✅` : 
                        job.status === 'failed' ? (job.error_message || 'Generation failed') :
                        'Generating…',
                createdAt: new Date(job.created_at).getTime() + 1000,
                status: job.status === 'completed' ? 'complete' : 
                        job.status === 'failed' ? 'error' : 'pending',
                jobId: job.id,
                // Add mediaUrl from batch fetch if available
                ...(signedUrlMap.has(job.id) && {
                  mediaUrl: signedUrlMap.get(job.id),
                  mediaType: job.result_type === 'video' ? 'video' : 'image'
                })
              }
              gen.pushMessage(tabKey, assistantMessage)
            } else {
              assistantMessage = existingMessages.find(m => m.jobId === job.id && m.role === 'assistant')
              // Update existing message with mediaUrl if we fetched it
              if (assistantMessage && signedUrlMap.has(job.id)) {
                gen.updateMessage(tabKey, assistantMessage.id, {
                  mediaUrl: signedUrlMap.get(job.id),
                  mediaType: job.result_type === 'video' ? 'video' : 'image'
                })
              }
            }

            // If job is still pending/processing, start polling
            if ((job.status === 'pending' || job.status === 'processing') && assistantMessage) {
              startJobPolling(tabKey, assistantMessage.id, job.id)
            }
          })
        })

        console.log(`⏱️ Total load time: ${(performance.now() - startTime).toFixed(0)}ms`)
        
        // Mark as loaded successfully
        hasLoadedOnce.current = true

      } catch (error) {
        console.error('Error in loadAndPollJobs:', error)
      } finally {
        isLoadingJobs.current = false
      }
    }

    // Load jobs after a short delay to let context initialize
    const timeoutId = setTimeout(() => {
      loadAndPollJobs().then(() => {
        // Scroll to bottom after jobs and media are loaded
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'instant', block: 'end' })
        }, 1000)
      })
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [user.id]) // Only run when user changes

  const getSignedUrlForJob = async (job: any, tab: keyof typeof gen.histories, messageId: string) => {
    try {
      const { data: signedUrl } = await supabase.storage
        .from('results')
        .createSignedUrl(job.result_url, 3600)

      if (signedUrl?.signedUrl) {
        gen.updateMessage(tab, messageId, {
          mediaUrl: signedUrl.signedUrl,
          mediaType: job.result_type === 'video' ? 'video' : 'image'
        })
      }
    } catch (error) {
      console.error('Error getting signed URL:', error)
    }
  }

  const startJobPolling = (tab: keyof typeof gen.histories, messageId: string, jobId: string) => {
    // Prevent duplicate polling for the same job
    if (activePolling.current.has(jobId)) {
      console.log(`🔄 [JobRecovery] Already polling job ${jobId}, skipping`)
      return
    }
    console.log('[JobRecovery] startJobPolling INIT', { tab, messageId, jobId })
    activePolling.current.add(jobId)
    
    const pollJob = async () => {
      try {
        console.log('[JobRecovery] pollJob tick', { jobId, tab, messageId })
        // Call the status endpoint so backend can advance processing (important after refresh)
        const statusResp = await fetch(`${CHECK_JOB_STATUS_ENDPOINT}?jobId=${jobId}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` }
        })

        if (!statusResp.ok) {
          console.error('[JobRecovery] Status endpoint error', statusResp.status)
          const timeoutId = setTimeout(pollJob, 3000)
          activeTimeouts.current.add(timeoutId)
          return
        }

        const statusData = await statusResp.json()
        console.log('[JobRecovery] statusData', statusData)

        if (statusData.status === 'completed' && statusData.result_url) {
          // Fetch signed URL
          const { data: signedUrl } = await supabase.storage
            .from('results')
            .createSignedUrl(statusData.result_url, 3600)

          gen.updateMessage(tab, messageId, {
            status: 'complete',
            content: `${tab.includes('video') ? 'Video' : 'Image'} generated ✅`,
            mediaUrl: signedUrl?.signedUrl || null,
            mediaType: tab.includes('video') ? 'video' : 'image'
          })
          activePolling.current.delete(jobId)
          return
        }

        if (statusData.status === 'failed') {
          gen.updateMessage(tab, messageId, {
            status: 'error',
            content: statusData.error || 'Generation failed'
          })
          activePolling.current.delete(jobId)
          return
        }

        // Still processing
        gen.updateMessage(tab, messageId, {
          status: 'pending',
            content: statusData.message || 'Generation in progress'
        })
        const timeoutId = setTimeout(pollJob, 3000)
        activeTimeouts.current.add(timeoutId)
      } catch (error) {
        console.error('Error in polling:', error)
        gen.updateMessage(tab, messageId, { 
          status: 'error',
          content: 'Error checking generation status'
        })
        activePolling.current.delete(jobId)
      }
    }

    // Start polling immediately
    pollJob()
  }

  const handleExample = (fullPrompt: string) => {
    setInput(fullPrompt)
    // Auto-resize after setting text
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = Math.min(120, Math.max(40, textareaRef.current.scrollHeight)) + 'px'
      }
    }, 0)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    // Auto-resize as user types
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(120, Math.max(40, e.target.scrollHeight)) + 'px'
  }

  const handleUploadClick = () => fileInputRef.current?.click()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setLocalFile(f)
      setLocalPreview(URL.createObjectURL(f))
    }
  }

  const aspectOptions: { label: string; value: typeof gen.aspectRatio; ratio: string }[] = [
    { label: '16:9', value: 'landscape', ratio: '16:9' },
    { label: '9:16', value: 'portrait', ratio: '9:16' },
  ]
  // Removed resolutions per request

  // Drag & drop state
  const [isDragging, setIsDragging] = useState(false)

  const sendPrompt = async () => {
    console.log(`[ChatGenerator] *** SEND PROMPT CALLED ***`)
    console.log(`[ChatGenerator] Input: "${input}"`)
    console.log(`[ChatGenerator] Is submitting: ${isSubmitting}`)
    console.log(`[ChatGenerator] Is locked: ${isLocked}`)
    console.log(`[ChatGenerator] Requires image: ${requiresImage}`)
    console.log(`[ChatGenerator] Local file: ${localFile ? 'present' : 'none'}`)
    
    if (!input.trim() || isSubmitting) {
      console.log(`[ChatGenerator] Blocked: No input or already submitting`)
      return
    }
    if (isLocked) {
      console.log(`[ChatGenerator] Blocked: Feature locked`)
      onLockedFeature?.()
      return
    }
    if (requiresImage && !localFile) {
      console.log(`[ChatGenerator] Blocked: Image required but not provided`)
      onLockedFeature?.()
      return
    }

    console.log(`[ChatGenerator] Proceeding with generation...`)
    setIsSubmitting(true)

    // Validate image requirement early
    if (requiresImage && !localFile) {
      console.error(`[ChatGenerator] ERROR: Image required but not provided`)
      alert('Please upload a reference image first')
      setIsSubmitting(false)
      return
    }

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: input.trim(),
      createdAt: Date.now(),
      status: 'complete'
    }
    gen.pushMessage(gen.activeTab, userMsg)

    // Capture the tab at the moment the generation starts so tab switches don't break updates
    const tabAtRequest = gen.activeTab

    const assistantPlaceholder: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: 'Generating…',
      createdAt: Date.now(),
      status: 'pending'
    }
    gen.pushMessage(tabAtRequest, assistantPlaceholder)

    setInput('')
    
    // Capture the local file BEFORE clearing it
    const fileToUpload = localFile
    
    // Clear the local file and preview after sending (but we keep fileToUpload)
    setLocalFile(null)
    setLocalPreview(null)

    try {
      console.log(`[ChatGenerator] Setting isGenerating to true`)
  gen.setIsGenerating(true)

      console.log(`[ChatGenerator] CHECK - requiresImage:`, requiresImage, 'fileToUpload:', !!fileToUpload, 'fileToUpload object:', fileToUpload)

      // Upload image if needed
      let imageId: string | null = null
      if (requiresImage && fileToUpload) {
        try {
          console.log(`[ChatGenerator] Starting image upload...`)
          console.log(`[ChatGenerator] File details:`, { name: fileToUpload.name, size: fileToUpload.size, type: fileToUpload.type })
          
          const fileName = `${user.id}/${Date.now()}-${fileToUpload.name}`
          console.log(`[ChatGenerator] Upload filename: ${fileName}`)
          console.log(`[ChatGenerator] Calling supabase.storage.from('uploads').upload()...`)
          
          const { data: uploadData, error: uploadErr } = await supabase.storage.from('uploads').upload(fileName, fileToUpload)
          
          console.log(`[ChatGenerator] Upload response - data:`, uploadData, 'error:', uploadErr)
          
          if (uploadErr) {
            console.error(`[ChatGenerator] Upload error:`, uploadErr)
            throw new Error(`Upload failed: ${uploadErr.message}`)
          }
          console.log(`[ChatGenerator] Upload successful:`, uploadData)
          
          console.log(`[ChatGenerator] Creating image record in database...`)
          console.log(`[ChatGenerator] Image record payload:`, {
            user_id: user.id,
            file_path: uploadData.path,
            original_name: fileToUpload.name,
            folder_id: null
          })
          
          const { data: imageData, error: imageDbErr } = await supabase.from('images').insert({
            user_id: user.id,
            file_path: uploadData.path,
            original_name: fileToUpload.name,
            folder_id: null
          }).select().single()
          
          console.log(`[ChatGenerator] Database insert result - error:`, imageDbErr, 'data:', imageData)
          
          if (imageDbErr) {
            console.error(`[ChatGenerator] Image DB error:`, imageDbErr)
            // Clean up uploaded file if DB insert fails
            await supabase.storage.from('uploads').remove([uploadData.path])
            throw new Error(`Database error: ${imageDbErr.message}`)
          }
          console.log(`[ChatGenerator] Image record created:`, imageData)
          imageId = imageData.id
        } catch (uploadError) {
          console.error(`[ChatGenerator] ❌ IMAGE UPLOAD FAILED:`, uploadError)
          throw uploadError
        }
      } else {
        console.log(`[ChatGenerator] No image upload required (requiresImage: ${requiresImage}, fileToUpload: ${!!fileToUpload})`)
      }

      console.log(`[ChatGenerator] About to create job...`)
      console.log(`[ChatGenerator] Current state - imageId:`, imageId)
      console.log(`[ChatGenerator] Current state - meta:`, meta)
      console.log(`[ChatGenerator] Current state - aspectRatio:`, gen.aspectRatio)

      // Create job
      console.log(`[ChatGenerator] Creating job record...`)
      // Attach aspect ratio suffix to model ONLY for video models (sora-2)
      // Image models (gemini) don't need aspect ratio in the model name
      const isVideoModel = meta.resultType === 'video'
      const aspectSuffix = isVideoModel 
        ? (gen.aspectRatio === 'landscape' ? '-landscape' : gen.aspectRatio === 'portrait' ? '-portrait' : '')
        : ''
      
      const baseModel = meta.model === 'sora-2' ? 'sora-2' : meta.model
      const jobPayload: any = {
        user_id: user.id,
        model: `${baseModel}${aspectSuffix}`,
        prompt: userMsg.content,
        status: 'pending',
        result_type: meta.resultType,
        has_images: !!imageId,
        image_ids: imageId ? [imageId] : [],
        image_id: imageId || null
      }
      console.log(`[ChatGenerator] Job payload:`, jobPayload)
      
      const { data: job, error: jobErr } = await supabase.from('jobs').insert(jobPayload).select().single()
      if (jobErr) {
        console.error(`[ChatGenerator] Job creation error:`, jobErr)
        throw new Error(jobErr.message)
      }
      console.log(`[ChatGenerator] Job created successfully:`, job)

      // Update the assistant message with the job ID so we can resume polling after refresh
  gen.updateMessage(tabAtRequest, assistantPlaceholder.id, { jobId: job.id })

      const endpoint = ENDPOINT_MAP[tabAtRequest]
      console.log(`[ChatGenerator] *** STARTING REQUEST ***`)
  console.log(`[ChatGenerator] Active tab (live): ${gen.activeTab} | tabAtRequest (frozen): ${tabAtRequest}`)
      console.log(`[ChatGenerator] Endpoint: ${endpoint}`)
      console.log(`[ChatGenerator] JobId: ${job.id}`)
      console.log(`[ChatGenerator] Job data:`, job)
      console.log(`[ChatGenerator] Anon key exists:`, !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      console.log(`[ChatGenerator] Anon key preview:`, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20) + '...')
      
      // Add timeout to detect hanging requests
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.error(`[ChatGenerator] Request timed out after 30 seconds`)
        controller.abort()
      }, 30000) // 30 second timeout
      
      console.log(`[ChatGenerator] Making fetch request...`)
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ jobId: job.id }),
        signal: controller.signal
      }).catch((fetchError) => {
        console.error(`[ChatGenerator] Fetch failed:`, fetchError)
        console.error(`[ChatGenerator] Fetch error name:`, fetchError.name)
        console.error(`[ChatGenerator] Fetch error message:`, fetchError.message)
        throw fetchError
      })
      
      clearTimeout(timeoutId)
      console.log(`[ChatGenerator] Response received`)
      console.log(`[ChatGenerator] Response status: ${resp.status}`)
      console.log(`[ChatGenerator] Response statusText: ${resp.statusText}`)
      console.log(`[ChatGenerator] Response headers:`, Object.fromEntries(resp.headers.entries()))
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}))
        console.error(`[ChatGenerator] API Response Error for ${gen.activeTab}:`, resp.status, errData)
        console.error(`[ChatGenerator] Response headers:`, Object.fromEntries(resp.headers.entries()))
        throw new Error(errData.error || `HTTP ${resp.status}: Generation failed`)
      }
      const responseData = await resp.json()
      console.log(`[ChatGenerator] Response from ${gen.activeTab}:`, responseData)
      
      if (!responseData.success) {
        throw new Error(responseData.error || 'Generation failed')
      }

      // Task created successfully, now poll for results
      gen.updateMessage(tabAtRequest, assistantPlaceholder.id, {
        status: 'pending',
        content: 'Processing with AI...'
      })

      // Poll for results every 3 seconds
      const pollForResult = async (): Promise<void> => {
        try {
          const statusResp = await fetch(`${CHECK_JOB_STATUS_ENDPOINT}?jobId=${job.id}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
            }
          })

          if (!statusResp.ok) {
            throw new Error(`Status check failed: ${statusResp.status}`)
          }

          const statusData = await statusResp.json()

          if (statusData.status === 'completed' && statusData.result_url) {
            console.log(`[ChatGenerator] 🎉 GENERATION COMPLETED! Result URL: ${statusData.result_url}`)
            
            // Create signed URL - same as library does
            console.log(`[ChatGenerator] 🔗 Creating signed URL...`)
            const { data: signedUrl } = await supabase.storage
              .from('results')
              .createSignedUrl(statusData.result_url, 3600)

            console.log(`[ChatGenerator] 🔗 Signed URL result:`, signedUrl)
            
            const mediaUrl = signedUrl?.signedUrl || ''
            console.log(`[ChatGenerator] 🖼️ FINAL MEDIA URL: ${mediaUrl}`)
            
            if (!mediaUrl) {
              console.error(`[ChatGenerator] ❌ NO MEDIA URL - CANNOT SHOW IMAGE!`)
              console.error(`[ChatGenerator] signedUrl:`, signedUrl)
              console.error(`[ChatGenerator] statusData:`, statusData)
            }

            console.log(`[ChatGenerator] 📝 Updating message with data:`, {
              messageId: assistantPlaceholder.id,
              activeTab: gen.activeTab,
              status: 'complete',
              content: meta.resultType === 'image' ? 'Image generated ✅' : 'Video generated ✅',
              mediaUrl,
              mediaType: meta.resultType
            })

            gen.updateMessage(tabAtRequest, assistantPlaceholder.id, {
              status: 'complete',
              content: meta.resultType === 'image' ? 'Image generated ✅' : 'Video generated ✅',
              mediaUrl,
              mediaType: meta.resultType
            })
            
            console.log(`[ChatGenerator] ✅ MESSAGE UPDATE COMPLETED!`)
            console.log(`[ChatGenerator] 🎯 Final message should show image with URL: ${mediaUrl}`)
            
            // Clear all active timeouts
            activeTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId))
            activeTimeouts.current.clear()
            
            // Make sure to reset generating state
            gen.setIsGenerating(false)
            console.log(`[ChatGenerator] 🔄 isGenerating set to false`)
            return
          }

          if (statusData.status === 'failed') {
            // Clear all active timeouts
            activeTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId))
            activeTimeouts.current.clear()
            gen.setIsGenerating(false)
            throw new Error(statusData.error || 'Generation failed')
          }

          // Still processing, continue polling
          gen.updateMessage(tabAtRequest, assistantPlaceholder.id, {
            status: 'pending',
            content: statusData.message || 'Still processing...'
          })

          // Poll again in 3 seconds
          const timeoutId = setTimeout(pollForResult, 3000)
          activeTimeouts.current.add(timeoutId)
        } catch (error) {
          console.error('Polling error:', error)
          // Clear all active timeouts
          activeTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId))
          activeTimeouts.current.clear()
          gen.setIsGenerating(false)
          gen.updateMessage(tabAtRequest, assistantPlaceholder.id, {
            status: 'error',
            content: `Polling failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          })
        }
      }

      // Start polling after 3 seconds
      const initialTimeoutId = setTimeout(pollForResult, 3000)
      activeTimeouts.current.add(initialTimeoutId)
    } catch (e: any) {
      console.error(`[ChatGenerator] *** GENERATION ERROR ***`)
      console.error(`[ChatGenerator] Error for ${gen.activeTab}:`, e)
      console.error(`[ChatGenerator] Error name:`, e.name)
      console.error(`[ChatGenerator] Error message:`, e.message)
      console.error(`[ChatGenerator] Full error:`, e)
      
      let errorMessage = e.message || 'Failed to generate.'
      if (e.name === 'AbortError') {
        errorMessage = 'Request timed out after 30 seconds. Please try again.'
      }
      
      gen.updateMessage(tabAtRequest, assistantPlaceholder.id, {
        status: 'error',
        content: errorMessage
      })
    } finally {
      gen.setIsGenerating(false)
      setIsSubmitting(false)
    }
  }

  // Realtime subscription: listen for job status changes so UI updates immediately even if polling misses or user refreshes
  useEffect(() => {
    const channel = supabase.channel('jobs-realtime')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'jobs',
        filter: `user_id=eq.${user.id}`
      }, async (payload) => {
        const newRow: any = payload.new
        const jobId = newRow.id
        const status = newRow.status
        console.log(`[ChatGenerator][Realtime] Job ${jobId} updated to ${status}`)
        console.log(`[ChatGenerator][Realtime] Payload:`, payload)
        
        // Find which tab this job belongs to by deriving from row (mirrors logic in loadAndPollJobs)
        const tabKey: keyof typeof gen.histories = newRow.has_images
          ? (newRow.result_type === 'video' ? 'image-to-video' : 'image-to-image')
          : (newRow.result_type === 'video' ? 'text-to-video' : 'text-to-image')

        console.log(`[ChatGenerator][Realtime] Determined tab: ${tabKey}`)

        // Locate assistant message with this jobId
        const messages = gen.histories[tabKey]
        const assistantMsg = messages.find(m => m.jobId === jobId && m.role === 'assistant')
        console.log(`[ChatGenerator][Realtime] Found assistant message:`, assistantMsg?.id)
        if (!assistantMsg) {
          console.log(`[ChatGenerator][Realtime] No assistant message found for job ${jobId} in tab ${tabKey}`)
          return
        }

        if (status === 'completed' && newRow.result_url && !assistantMsg.mediaUrl) {
          console.log(`[ChatGenerator][Realtime] Job completed, getting signed URL for:`, newRow.result_url)
          try {
            const { data: signed, error: signedError } = await supabase.storage.from('results').createSignedUrl(newRow.result_url, 3600)
            console.log(`[ChatGenerator][Realtime] Signed URL result:`, { signed, signedError })
            
            if (signedError) {
              console.error(`[ChatGenerator][Realtime] Signed URL error:`, signedError)
              return
            }
            
            console.log(`[ChatGenerator][Realtime] Updating message ${assistantMsg.id} with mediaUrl:`, signed?.signedUrl)
            
            gen.updateMessage(tabKey, assistantMsg.id, {
              status: 'complete',
              content: newRow.result_type === 'video' ? 'Video generated ✅' : 'Image generated ✅',
              mediaUrl: signed?.signedUrl || null,
              mediaType: newRow.result_type
            })
            console.log(`[ChatGenerator][Realtime] Updated message ${assistantMsg.id} for job ${jobId} to completed`)
          } catch (err) {
            console.error('[ChatGenerator][Realtime] Signed URL error:', err)
          }
        } else if ((status === 'failed' || status === 'error') && assistantMsg.status !== 'error') {
          gen.updateMessage(tabKey, assistantMsg.id, {
            status: 'error',
            content: newRow.error_message || 'Generation failed'
          })
        }
      })
      .subscribe((status) => {
        console.log('[ChatGenerator][Realtime] Subscription status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user.id]) // Only depend on user.id, supabase is now stable

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendPrompt()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-gray-200 bg-white px-6 py-3 flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-gray-800">{meta.title}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{meta.subtitle}</p>
        </div>
        <div className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1.5 rounded-full font-medium shadow-sm">
          ⭐ {profile.credits} credits
        </div>
      </div>

      {/* Chat scroll area */}
      <div 
        className="flex-1 overflow-y-auto px-8 py-6 bg-[#f7f7f8] space-y-6 relative"
        onDragOver={(e) => { e.preventDefault(); if (requiresImage) setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          if (!requiresImage) return;
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file && file.type.startsWith('image/')) {
            setLocalFile(file)
            setLocalPreview(URL.createObjectURL(file))
          }
        }}
      >
        {isDragging && requiresImage && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm border-2 border-dashed border-purple-400 rounded-xl">
            <div className="text-center text-purple-600 font-medium text-sm flex flex-col items-center gap-2">
              <span className="text-4xl">📁</span>
              Drop your reference image here
            </div>
          </div>
        )}
        {history.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div 
              onClick={requiresImage ? handleUploadClick : undefined}
              className={`max-w-lg w-full text-center px-8 py-12 rounded-xl border-2 ${
                requiresImage 
                  ? 'border-dashed border-purple-300 bg-purple-50/30 cursor-pointer hover:bg-purple-50/50 hover:border-purple-400 transition-all' 
                  : 'border-gray-200 bg-white'
              }`}
            >
              {requiresImage ? (
                <>
                  <div className="flex justify-center gap-3 mb-4 text-4xl">
                    <span>📷</span>
                    <span>🖼️</span>
                    <span>📁</span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-800 mb-2">Upload Your Reference Image</h3>
                  <p className="text-sm text-gray-600 leading-relaxed mb-1">
                    Click here or drag & drop an image to start transforming.
                  </p>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs text-gray-500">
                      Supports JPG, PNG up to 10MB
                    </p>
                    <div className="bg-green-50 border border-green-200 px-3 py-1 rounded-xl">
                      <span className="text-xs font-medium text-green-700">
                        {gen.activeTab === 'image-to-video' ? '8 credits per video' : '1 credit per image'}
                      </span>
                    </div>
                  </div>
                </>
              ) : gen.activeTab.includes('video') ? (
                <>
                  <div className="text-5xl mb-4">🎬</div>
                  <h3 className="text-base font-semibold text-gray-800 mb-2">Describe Your Video Scene</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Describe motion, camera movements, duration, and visual storytelling. Include scene transitions, object movements, and cinematic style.
                  </p>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs text-gray-400">
                      Example: "8-second dolly shot of a luxury perfume bottle rotating on marble, soft lighting, elegant motion blur"
                    </p>
                    <div className="bg-orange-50 border border-orange-200 px-3 py-1 rounded-xl">
                      <span className="text-xs font-medium text-orange-700">8 credits per video</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-5xl mb-4">✨</div>
                  <h3 className="text-base font-semibold text-gray-800 mb-2">Describe Your Vision</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Use rich details: lighting, materials, mood, camera angles, and visual style. The more specific, the better your result.
                  </p>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs text-gray-400">
                      Example: "Luxury watch on marble surface, dramatic lighting, macro lens, professional product photography"
                    </p>
                    <div className="bg-green-50 border border-green-200 px-3 py-1 rounded-xl">
                      <span className="text-xs font-medium text-green-700">1 credit per image</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    Example: "Cinematic shot of a premium water bottle on wet stone, soft morning light, shallow depth of field"
                  </p>
                </>
              )}
            </div>
          </div>
        )}
        {history.map(m => (
            <div key={m.id} className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`${m.role === 'user' ? 'bg-purple-600 text-white rounded-2xl rounded-br-sm' : 'bg-white border border-gray-200 rounded-2xl rounded-bl-sm'} px-4 py-3 shadow-sm text-sm max-w-[65%]`}>
              <div className="whitespace-pre-wrap leading-relaxed">
                {m.content}
              </div>
              {m.status === 'pending' && (
                <div className="mt-3 w-[320px] sm:w-[420px] h-[200px] sm:h-[280px] rounded-lg bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 relative overflow-hidden border border-purple-200/50">
                  {/* Animated shimmer */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-[shimmer_2s_infinite] -translate-x-full" />
                  
                  {/* Pulsing dots */}
                  <div className="absolute top-4 left-4 flex gap-1">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                  </div>
                  
                  {/* Rotating spinner */}
                  <div className="absolute top-4 right-4">
                    <div className="w-4 h-4 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
                  </div>
                  
                  {/* Center text with typing animation */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <div className="text-purple-600 font-medium text-sm mb-1">
                      Generating {meta.resultType}
                    </div>
                    <div className="text-xs text-purple-500/70 animate-pulse">
                      This may take {meta.resultType === 'video' ? '2-5 minutes' : '30-60 seconds'}
                    </div>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="absolute bottom-4 left-4 right-4 h-1 bg-purple-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-[progress_3s_ease-in-out_infinite]" />
                  </div>
                </div>
              )}
              {m.mediaUrl && m.mediaType === 'image' && (
                <div className="mt-3 relative group">
                  <Image 
                    src={m.mediaUrl} 
                    alt="Generated result" 
                    width={400} 
                    height={400} 
                    className="rounded-lg w-full max-w-[400px] shadow-sm cursor-pointer hover:shadow-lg transition-shadow" 
                    onClick={() => m.mediaUrl && window.open(m.mediaUrl, '_blank')}
                  />
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={async () => {
                        try {
                          const response = await fetch(m.mediaUrl!)
                          const blob = await response.blob()
                          const url = window.URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `generated-image-${Date.now()}.png`
                          document.body.appendChild(a)
                          a.click()
                          window.URL.revokeObjectURL(url)
                          document.body.removeChild(a)
                        } catch (e) {
                          console.error('Download failed:', e)
                        }
                      }}
                      className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full text-sm transition-colors"
                      title="Download image"
                    >
                      ⬇️
                    </button>
                  </div>
                </div>
              )}
              {m.mediaUrl && m.mediaType === 'video' && (
                <div className="mt-3 relative group">
                  <video 
                    src={m.mediaUrl} 
                    controls 
                    className="rounded-lg w-full max-w-[500px] shadow-md" 
                  />
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={async () => {
                        try {
                          const response = await fetch(m.mediaUrl!)
                          const blob = await response.blob()
                          const url = window.URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `generated-video-${Date.now()}.mp4`
                          document.body.appendChild(a)
                          a.click()
                          window.URL.revokeObjectURL(url)
                          document.body.removeChild(a)
                        } catch (e) {
                          console.error('Download failed:', e)
                        }
                      }}
                      className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full text-sm transition-colors"
                      title="Download video"
                    >
                      ⬇️
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Bottom input bar */}
      <div className="border-t border-gray-200 bg-white px-4 py-3 flex flex-col gap-2 shadow-inner">
        {/* Examples */}
        <div className="flex gap-2 overflow-x-scroll text-xs text-gray-600 pb-1 scrollbar-hide">
          {EXAMPLES[gen.activeTab].map(ex => (
            <button
              key={ex.short}
              onClick={() => handleExample(ex.full)}
              className="px-2 py-1 md:px-3 md:py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition text-gray-600 whitespace-nowrap border border-gray-200 hover:border-gray-300 text-[10px] md:text-xs flex-shrink-0"
              title={ex.full}
            >
              {ex.short}
            </button>
          ))}
        </div>
        {/* Prompt Row */}
        <div className="flex items-center gap-2">
          {requiresImage && (
            <>
              <button
                onClick={handleUploadClick}
                className="text-xl hover:opacity-80 cursor-pointer"
                title="Upload reference image"
              >📎</button>
              <input ref={fileInputRef} onChange={handleFileChange} type="file" accept="image/*" className="hidden" />
              {localPreview && (
                <div className="relative group">
                  <Image src={localPreview} alt="preview" width={40} height={40} className="rounded-md object-cover" />
                  <button
                    onClick={() => {
                      setLocalFile(null)
                      setLocalPreview(null)
                    }}
                    className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove image"
                  >
                    ×
                  </button>
                </div>
              )}
            </>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={onKeyDown}
            placeholder="Describe your idea or drop an image…"
            rows={1}
            className="flex-1 border border-gray-300 rounded-2xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none overflow-hidden min-h-[40px] max-h-[120px]"
            style={{ height: '40px' }}
          />
          <button
            onClick={sendPrompt}
            disabled={gen.isGenerating || isSubmitting || (requiresImage && !localFile) || !input.trim()}
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-5 py-2 rounded-full text-sm font-semibold hover:scale-[1.03] active:scale-[0.97] transition disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
          >
            <span>⚡ Generate</span>
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
              {meta.resultType === 'video' ? '8' : '1'} credit{meta.resultType === 'video' ? 's' : ''}
            </span>
          </button>
        </div>
        {/* Quick controls - only render client-side to prevent hydration mismatch */}
        {isMounted && (
          <div className="flex justify-center gap-4 mt-1 flex-wrap text-xs text-gray-500">
            <div className="flex gap-2 items-center">
              {aspectOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => gen.setAspectRatio(opt.value)}
                  className={`${gen.aspectRatio === opt.value ? 'bg-purple-50 border border-purple-500 text-purple-600 font-semibold' : 'border border-gray-200 hover:bg-gray-50'} rounded-md px-2 py-1 transition`}
                >{opt.label}</button>
              ))}
            </div>
            {/* Resolutions removed */}
          </div>
        )}
      </div>
    </div>
  )
}
