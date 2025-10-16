'use client'

import { useEffect, useRef, useState } from 'react'
import { useGenerator, ChatMessage } from '@/contexts/GeneratorContext'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/validations'
import PricingPlans from './PricingPlans'
import { toast } from 'sonner'
import FirstTimeOnboarding from './FirstTimeOnboarding'
import UpgradePrompt from './UpgradePrompt'
import { useOnboarding } from '@/hooks/useOnboarding'

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
  'text-to-music': `${SUPABASE_FUNCTIONS_BASE}/generate-text-music`,
}

const CHECK_JOB_STATUS_ENDPOINT = `${SUPABASE_FUNCTIONS_BASE}/check-job-status`

const TAB_META: Record<string, { title: string; subtitle: string; locked?: boolean; model: string; resultType: 'image' | 'video' | 'music' }> = {
  'text-to-image': { title: '📝 Text to Image', subtitle: 'Generate product-ready visuals from ideas', model: 'gemini', resultType: 'image' },
  'image-to-image': { title: '🖼 Image to Image', subtitle: 'Transform or restyle an input image', model: 'gemini', resultType: 'image' },
  'text-to-video': { title: '🎬 Text to Video', subtitle: 'Bring concepts to motion with AI video', locked: true, model: 'seedream', resultType: 'video' },
  'image-to-video': { title: '🎥 Image to Video', subtitle: 'Animate a still into dynamic video', locked: true, model: 'seedream', resultType: 'video' },
  'text-to-music': { title: '🎵 Text to Music', subtitle: 'Create original music from text descriptions', locked: true, model: 'suno', resultType: 'music' },
}

const EXAMPLES: Record<string, Array<{ short: string; full: string }>> = {
  'text-to-image': [
    {
      short: '☕ Coffee Cup on Wooden Table',
      full: 'Ultra-detailed cinematic product photo of a double-walled glass coffee mug filled with creamy latte topped with intricate heart-shaped latte art foam, placed on a wet rustic wooden counter at sunrise, soft volumetric light through a foggy café window, gentle steam rising, shallow depth of field (50mm f/1.8), realistic micro-droplets on the glass, warm morning tones, crisp reflections, professional food photography, editorial style'
    },
    {
      short: '💄 Skincare Bottle with Water Splash',
      full: 'Ultra-detailed cinematic product photo of a premium skincare serum bottle on a rippled water surface with crystal-clear gel splashes frozen mid-air, soft morning spa ambience, diffused natural daylight, gentle mist and reflections, elegant pastel tones, minimalist luxury aesthetic, studio macro photography, 85mm lens, ultra high resolution, editorial beauty lighting'
    },
    {
      short: '🏃‍♀️ Sport Bottle in Motion',
      full: 'Ultra-detailed cinematic action shot of a dynamic sport water bottle mid-squeeze, crystal droplets suspended in air, illuminated by dramatic rim and back lighting, stadium tunnel background with subtle motion blur, vibrant energetic color grading, high-speed photography, 85mm lens, ultra-sharp focus, professional commercial lighting, editorial sports aesthetic'
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
      short: '🎤 Street Interview in the City',
      full: '10 second cinematic street interview scene with a friendly reporter holding a microphone, asking a smiling passerby “What makes you happiest in life?” on a busy urban sidewalk. The passerby laughs and replies warmly, mentioning spending time with family. Natural city ambience with footsteps, crowd chatter, and light traffic. Soft daylight, shallow depth of field, authentic handheld motion, realistic dialogue audio, subtle background blur.'
    },
    {
      short: '🦊 Talking Fox in Forest',
      full: '8 second whimsical cinematic shot of a red fox sitting in a misty forest clearing at sunrise, softly speaking in a calm, expressive voice about appreciating nature and peace — saying “Every dawn feels like a fresh start.” Gentle lip-sync animation, warm forest ambience with birds chirping and rustling leaves, soft golden-hour lighting, shallow depth of field, gentle camera dolly-in, natural color grading.'
    },
    {
      short: '🍃 Misty Mountain Valley at Sunrise',
      full: '10 second ultra-realistic cinematic nature shot of a misty mountain valley at sunrise. Soft fog rolling through pine trees, sunlight beams scattering through clouds, occasional birds gliding through frame. No human sound — only gentle wind, distant birds, and ambient nature echo. Wide aerial view, natural color grading, cinematic stabilization, 8K film look.'
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
  ],

  'text-to-music': [
    {
      short: '🤠 Country Love Song – Sunset Bar',
      full: 'Country-style song about a man and woman falling in love at a small-town bar during sunset. Start soft with acoustic guitar and warm vocals, build up to a heartfelt chorus with fiddle and drums, then fade into gentle steel guitar. Include romantic storytelling lyrics like: “She smiled through the dust and neon light.”'
    },
    {
      short: '🎸 Country Duet – Long Drive Home',
      full: 'Country duet between a man and woman driving home under moonlight after their first date. Begin with slow acoustic strumming, add light percussion and harmony on the second verse, final chorus introduces pedal steel and vocal layering. Include simple love lyrics like: “Every mile, your hand in mine feels like forever.”'
    },
    {
      short: '🎶 Image2Ad.com Jingle – One Click Creation',
      full: 'Upbeat catchy commercial jingle for Image2Ad.com. Fun pop-country rhythm with claps, guitar, and light synths. Vocals sing a short memorable hook: “At Image2Ad dot com — make your vision come alive, with just one click and you’re ready to shine!” Include cheerful melody, tagline repeats at the end, and smooth beat transitions showing the AI can create images, videos, and songs in seconds.'
    }
  ]
}

export default function ChatGenerator({ user, profile, onLockedFeature }: ChatGeneratorProps) {
  const gen = useGenerator()
  const supabase = createClient()
  const router = useRouter()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [localFiles, setLocalFiles] = useState<File[]>([])
  const [localPreviews, setLocalPreviews] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const activeTimeouts = useRef<Set<NodeJS.Timeout>>(new Set())
  const activePolling = useRef<Set<string>>(new Set()) // Track active polling jobs
  const [showCreditPopup, setShowCreditPopup] = useState(false)
  const [isUpgrading, setIsUpgrading] = useState<string | null>(null)

  // Onboarding integration
  const {
    shouldShowOnboarding,
    shouldHighlightGenerate,
    shouldShowUpgrade,
    prefillPrompt,
    handleOnboardingComplete,
    handleFirstGeneration,
    checkCreditsAndShowUpgrade,
    closeUpgradePrompt
  } = useOnboarding(user, profile)

  // Auto-fill prompt when onboarding completes
  useEffect(() => {
    if (prefillPrompt && !input) {
      setInput(prefillPrompt)
      // Auto-resize textarea
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto'
          textareaRef.current.style.height = Math.min(120, Math.max(40, textareaRef.current.scrollHeight)) + 'px'
        }
      }, 100)
    }
  }, [prefillPrompt, input])

  // Music-specific options
  const [makeInstrumental, setMakeInstrumental] = useState(false)
  const [musicTags, setMusicTags] = useState('')
  const [lyricsMode, setLyricsMode] = useState<'ai' | 'custom'>('ai') // 'ai' = AI generates lyrics, 'custom' = user provides
  const [customLyrics, setCustomLyrics] = useState('')
  const [musicDuration, setMusicDuration] = useState<10 | 30 | 60 | 120 | 180>(30) // Duration in seconds
  const [coverPrompt, setCoverPrompt] = useState('') // Optional custom prompt for cover image

  const meta = TAB_META[gen.activeTab]
  const history = gen.histories[gen.activeTab]
  const requiresImage = gen.activeTab === 'image-to-image' || gen.activeTab === 'image-to-video'
  const isMusicMode = gen.activeTab === 'text-to-music'
  // Check if feature is locked: only locked if marked as locked AND user doesn't have stripe customer ID
  const isLocked = !!meta.locked && !profile?.stripe_customer_id
  
  // Helper to get credit text based on user type
  const isFreeUser = !profile?.stripe_customer_id
  const getCreditText = () => {
    if (isFreeUser) {
      return profile.credits === 1 ? '1 free image remaining' : `${profile.credits} free images remaining`
    }
    return `${profile.credits} credits`
  }
  
  const getButtonCreditText = () => {
    const count = meta.resultType === 'music' ? 3 : meta.resultType === 'video' ? 8 : 1
    if (isFreeUser) {
      return count === 1 ? '1 free image' : `${count} free images`
    }
    return `${count} credit${count > 1 ? 's' : ''}`
  }
  
  const handleSubscribe = async (plan: 'starter' | 'pro' | 'business') => {
    setIsUpgrading(plan)
    try {
      // Create checkout session via API
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan,
          successUrl: `${window.location.origin}/billing?success=true`,
          cancelUrl: `${window.location.origin}${window.location.pathname}`,
        }),
      })

      if (response.ok) {
        const { url } = await response.json()
        window.location.href = url
      } else {
        const errorData = await response.json()
        console.error('Failed to create checkout session:', errorData.error)
        alert('Failed to start checkout. Please try again.')
        setIsUpgrading(null)
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert('Failed to start checkout. Please try again.')
      setIsUpgrading(null)
    }
  }
  

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
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
      try {
        console.log('Loading jobs from database...')
        // Get all jobs for this user, sorted by creation date
        const { data: jobs, error } = await supabase
          .from('jobs')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })

        if (error) {
          console.error('Error loading jobs:', error)
          return
        }

        if (!jobs || jobs.length === 0) {
          console.log('No jobs found')
          return
        }

        console.log(`Found ${jobs.length} jobs:`, jobs.map(j => ({ id: j.id, status: j.status, result_url: j.result_url })))

        // Convert jobs to chat messages and organize by type
        const jobsByType: Record<keyof typeof gen.histories, any[]> = {
          'text-to-image': [],
          'image-to-image': [],
          'text-to-video': [],
          'image-to-video': [],
          'text-to-music': []
        }

        // Group jobs by result type
        jobs.forEach(job => {
          let tabKey: keyof typeof gen.histories
          
          if (job.result_type === 'music') {
            tabKey = 'text-to-music'
          } else if (job.has_images) {
            tabKey = job.result_type === 'video' ? 'image-to-video' : 'image-to-image'
          } else {
            tabKey = job.result_type === 'video' ? 'text-to-video' : 'text-to-image'
          }
          
          jobsByType[tabKey].push(job)
        })

        // Update histories with jobs converted to messages
        Object.entries(jobsByType).forEach(([tab, tabJobs]) => {
          const tabKey = tab as keyof typeof gen.histories
          
          // Only build messages if this tab is empty (avoid duplicates)
          if (gen.histories[tabKey].length === 0) {
            tabJobs.forEach(job => {
            // Add user message
            const userMessage: ChatMessage = {
              id: `user-${job.id}`,
              role: 'user',
              content: job.prompt,
              createdAt: new Date(job.created_at).getTime()
            }
            gen.pushMessage(tabKey, userMessage)

            // Add assistant message based on job status
            const assistantMessage: ChatMessage = {
              id: `assistant-${job.id}`,
              role: 'assistant',
              content: job.status === 'completed' ? `${job.result_type === 'video' ? 'Video' : 'Image'} generated ✅` : 
                       job.status === 'failed' ? (job.error_message || 'Generation failed') :
                       'Generating…',
              createdAt: new Date(job.created_at).getTime() + 1000, // Slightly after user message
              status: job.status === 'completed' ? 'complete' : 
                      job.status === 'failed' ? 'error' : 'pending',
              jobId: job.id
            }

            gen.pushMessage(tabKey, assistantMessage)

            // If completed, get signed URL for result immediately  
            if (job.status === 'completed' && job.result_url) {
              getSignedUrlForJob(job, tabKey, assistantMessage.id)
            }

            // If job is still pending/processing, start polling
            if (job.status === 'pending' || job.status === 'processing') {
              startJobPolling(tabKey, assistantMessage.id, job.id)
            }
            })
          }
        })

      } catch (error) {
        console.error('Error in loadAndPollJobs:', error)
      }
    }

    // Load jobs after a short delay to let context initialize
    const timeoutId = setTimeout(loadAndPollJobs, 1000)
    return () => clearTimeout(timeoutId)
  }, [user.id]) // Only run when user changes

  const getSignedUrlForJob = async (job: any, tab: keyof typeof gen.histories, messageId: string) => {
    try {
      const { data: signedUrl } = await supabase.storage
        .from('results')
        .createSignedUrl(job.result_url, 3600)

      if (signedUrl?.signedUrl) {
        const updateData: any = {
          mediaUrl: signedUrl.signedUrl,
          mediaType: job.result_type === 'video' ? 'video' : job.result_type === 'music' ? 'music' : 'image'
        }

        // For music, also get cover URL if available
        if (job.result_type === 'music' && job.cover_url) {
          const { data: coverSignedUrl } = await supabase.storage
            .from('results')
            .createSignedUrl(job.cover_url, 3600)
          
          if (coverSignedUrl?.signedUrl) {
            updateData.coverUrl = coverSignedUrl.signedUrl
          }
        }

        gen.updateMessage(tab, messageId, updateData)
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
    
    activePolling.current.add(jobId)
    const startTime = Date.now()
    
    // Type-specific polling configuration
    // Images: Fast (immediate, 3s interval, 10min timeout)
    // Music: Medium (immediate, 5s interval, 10min timeout)  
    // Videos: Ultra-patient (immediate, 10s interval, 20min timeout)
    let maxDuration: number
    let pollInterval: number
    let initialDelay: number
    
    if (tab.includes('video')) {
      maxDuration = 1200000  // 20 minutes for videos - DON'T GIVE UP!
      pollInterval = 10000   // Poll every 10 seconds
      initialDelay = 0       // Start immediately - no waiting!
    } else if (tab.includes('music')) {
      maxDuration = 600000   // 10 minutes for music
      pollInterval = 5000    // Poll every 5 seconds
      initialDelay = 0       // Start immediately
    } else {
      maxDuration = 600000   // 10 minutes for images
      pollInterval = 3000    // Poll every 3 seconds
      initialDelay = 0       // Start immediately
    }
    
    const pollJob = async () => {
      try {
        // Check if we've exceeded the maximum duration
        const elapsed = Date.now() - startTime
        if (elapsed > maxDuration) {
          console.error(`⏱️ Polling timeout after ${Math.round(elapsed/1000)}s for job ${jobId}`)
          gen.updateMessage(tab, messageId, { 
            status: 'error',
            content: 'Generation is taking longer than expected. Please check your library later.'
          })
          activePolling.current.delete(jobId)
          return
        }
        
        // 🔥 CRITICAL: Call check-job-status Edge Function to actually check Kie.ai and download results
        const session = await supabase.auth.getSession()
        const token = session.data.session?.access_token
        
        if (!token) {
          console.error('No auth token for polling')
          activePolling.current.delete(jobId)
          return
        }
        
        const checkResponse = await fetch(`${CHECK_JOB_STATUS_ENDPOINT}?jobId=${jobId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
        
        if (!checkResponse.ok) {
          console.error(`❌ check-job-status returned ${checkResponse.status}`)
          const timeoutId = setTimeout(pollJob, pollInterval)
          activeTimeouts.current.add(timeoutId)
          return
        }
        
        const jobStatus = await checkResponse.json()
        console.log(`🔍 Polling job ${jobId}: status=${jobStatus.status}, elapsed=${Math.round(elapsed/1000)}s`)

        if (jobStatus.status === 'completed' && jobStatus.result_url) {
          console.log(`✅ Job ${jobId} completed! Getting signed URL...`)
          
          // Show success toast notification
          const contentType = tab.includes('video') ? 'Video' : tab.includes('music') ? 'Music' : 'Image'
          toast.success(`${contentType} generated successfully! 🎉`, {
            description: 'Your content is ready to view',
            duration: 5000,
          })
          
          // Get signed URL for the result
          const { data: signedUrl } = await supabase.storage
            .from('results')
            .createSignedUrl(jobStatus.result_url, 3600)

          if (signedUrl?.signedUrl) {
            
            gen.updateMessage(tab, messageId, {
              status: 'complete',
              content: `${tab.includes('video') ? 'Video' : tab.includes('music') ? 'Music' : 'Image'} generated ✅`,
              mediaUrl: signedUrl.signedUrl,
              mediaType: tab.includes('video') ? 'video' : tab.includes('music') ? 'music' : 'image'
            })
          } else {
            gen.updateMessage(tab, messageId, { 
              status: 'error',
              content: 'Error accessing generated content'
            })
          }
          
          // Remove from active polling
          activePolling.current.delete(jobId)
        } else if (jobStatus.status === 'failed' || jobStatus.status === 'error') {
          // Show error toast notification
          toast.error('Generation failed', {
            description: jobStatus.error_message || 'An error occurred during generation',
            duration: 5000,
          })
          
          gen.updateMessage(tab, messageId, { 
            status: 'error',
            content: jobStatus.error_message || 'Generation failed'
          })
          // Remove from active polling
          activePolling.current.delete(jobId)
        } else {
          // Still processing, continue polling
          console.log(`⏳ Job ${jobId} still ${jobStatus.status}, polling again in ${pollInterval/1000}s...`)
          const timeoutId = setTimeout(pollJob, pollInterval)
          activeTimeouts.current.add(timeoutId)
        }
      } catch (error) {
        console.error('Error in polling:', error)
        gen.updateMessage(tab, messageId, { 
          status: 'error',
          content: 'Error checking generation status'
        })
        activePolling.current.delete(jobId)
      }
    }

    // Start polling after initial delay
    console.log(`🚀 Starting polling for job ${jobId} after ${initialDelay/1000}s delay, max duration: ${maxDuration/1000}s, poll interval: ${pollInterval/1000}s`)
    const initialTimeoutId = setTimeout(pollJob, initialDelay)
    activeTimeouts.current.add(initialTimeoutId)
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
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      setLocalFiles(prevFiles => [...prevFiles, ...files])
      const newPreviews = files.map(f => URL.createObjectURL(f))
      setLocalPreviews(prevPreviews => [...prevPreviews, ...newPreviews])
    }
  }

  const removeFile = (index: number) => {
    setLocalFiles(prevFiles => prevFiles.filter((_, i) => i !== index))
    setLocalPreviews(prevPreviews => {
      // Revoke the URL to free memory
      URL.revokeObjectURL(prevPreviews[index])
      return prevPreviews.filter((_, i) => i !== index)
    })
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
    console.log(`[ChatGenerator] Local files: ${localFiles.length} file(s)`)
    
    if (!input.trim() || isSubmitting) {
      console.log(`[ChatGenerator] Blocked: No input or already submitting`)
      return
    }
    if (isLocked) {
      console.log(`[ChatGenerator] Blocked: Feature locked`)
      onLockedFeature?.()
      return
    }
    
    // Check if user has sufficient credits BEFORE generation
    const requiredCredits = meta.resultType === 'video' ? 8 : meta.resultType === 'music' ? 3 : 1
    if (profile.credits < requiredCredits) {
      console.log(`[ChatGenerator] Blocked: Insufficient credits (have: ${profile.credits}, need: ${requiredCredits})`)
      
      // Check if this is a free user who ran out of credits - show upgrade prompt
      if (checkCreditsAndShowUpgrade()) {
        // Upgrade prompt will be shown
        return
      }
      
      // Otherwise show regular credit popup
      setShowCreditPopup(true)
      return
    }
    
    if (requiresImage && localFiles.length === 0) {
      console.log(`[ChatGenerator] Blocked: Image required but not provided`)
      onLockedFeature?.()
      return
    }

    console.log(`[ChatGenerator] Proceeding with generation...`)
    setIsSubmitting(true)

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: input.trim(),
      createdAt: Date.now(),
      status: 'complete'
    }
    gen.pushMessage(gen.activeTab, userMsg)

    const assistantPlaceholder: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: shouldHighlightGenerate ? '☕ Brewing your ad...' : 'Generating…',
      createdAt: Date.now(),
      status: 'pending'
    }
    gen.pushMessage(gen.activeTab, assistantPlaceholder)

    // If this is the first generation, show animated progress messages
    if (shouldHighlightGenerate) {
      const messages = [
        '☕ Brewing your ad...',
        '🎨 Adding the perfect lighting...',
        '📸 Capturing the final shot...',
        '✨ Almost ready...'
      ]
      let messageIndex = 0
      const progressInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % messages.length
        gen.updateMessage(gen.activeTab, assistantPlaceholder.id, {
          content: messages[messageIndex]
        })
      }, 4000)
      
      // Store interval to clear it later
      activeTimeouts.current.add(progressInterval as any)
    }

    setInput('')
    
    // Clear the local files and previews after sending
    localPreviews.forEach(url => URL.revokeObjectURL(url)) // Free memory
    setLocalFiles([])
    setLocalPreviews([])

    try {
      console.log(`[ChatGenerator] Setting isGenerating to true`)
      gen.setIsGenerating(true)

      // Upload images if needed
      const imageIds: string[] = []
      if (requiresImage && localFiles.length > 0) {
        console.log(`[ChatGenerator] Starting upload of ${localFiles.length} image(s)...`)
        
        for (let i = 0; i < localFiles.length; i++) {
          const file = localFiles[i]
          console.log(`[ChatGenerator] Uploading image ${i + 1}/${localFiles.length}:`, { name: file.name, size: file.size, type: file.type })
          
          const fileName = `${user.id}/${Date.now()}-${i}-${file.name}`
          console.log(`[ChatGenerator] Upload filename: ${fileName}`)
          
          const { data: uploadData, error: uploadErr } = await supabase.storage.from('uploads').upload(fileName, file)
          
          if (uploadErr) {
            console.error(`[ChatGenerator] Upload error:`, uploadErr)
            throw new Error(`Upload failed: ${uploadErr.message}`)
          }
          console.log(`[ChatGenerator] Upload successful:`, uploadData)
          
          console.log(`[ChatGenerator] Creating image record in database...`)
          const { data: imageData, error: imageDbErr } = await supabase.from('images').insert({
            user_id: user.id,
            file_path: uploadData.path,
            original_name: file.name,
            folder_id: null
          }).select().single()
          
          if (imageDbErr) {
            console.error(`[ChatGenerator] Image DB error:`, imageDbErr)
            // Clean up uploaded file if DB insert fails
            await supabase.storage.from('uploads').remove([uploadData.path])
            throw new Error(`Database error: ${imageDbErr.message}`)
          }
          console.log(`[ChatGenerator] Image record created:`, imageData)
          imageIds.push(imageData.id)
        }
        console.log(`[ChatGenerator] All ${imageIds.length} images uploaded successfully`)
      } else {
        console.log(`[ChatGenerator] No image upload required (requiresImage: ${requiresImage}, localFiles: ${localFiles.length})`)
      }

      // Create job
      console.log(`[ChatGenerator] Creating job record...`)
      const jobPayload: any = {
        user_id: user.id,
        model: meta.model,
        prompt: userMsg.content,
        status: 'pending',
        result_type: meta.resultType,
        has_images: imageIds.length > 0,
        image_ids: imageIds,
        image_id: imageIds.length > 0 ? imageIds[0] : null,
        aspect_ratio: gen.aspectRatio // Add aspect ratio to job payload
      }
      
      console.log(`[ChatGenerator] Aspect ratio: ${gen.aspectRatio}, Model: ${jobPayload.model}`)
      
      // Add music-specific parameters
      if (isMusicMode) {
        jobPayload.music_options = {
          make_instrumental: makeInstrumental,
          tags: musicTags.trim() || undefined,
          lyrics_mode: lyricsMode,
          custom_lyrics: lyricsMode === 'custom' ? customLyrics.trim() : undefined,
          duration: musicDuration,
          cover_prompt: coverPrompt.trim() || undefined
        }
      }
      
      console.log(`[ChatGenerator] Job payload:`, jobPayload)
      
      const { data: job, error: jobErr } = await supabase.from('jobs').insert(jobPayload).select().single()
      if (jobErr) {
        console.error(`[ChatGenerator] Job creation error:`, jobErr)
        throw new Error(jobErr.message)
      }
      console.log(`[ChatGenerator] Job created successfully:`, job)

      // Update the assistant message with the job ID so we can resume polling after refresh
      gen.updateMessage(gen.activeTab, assistantPlaceholder.id, { jobId: job.id })

      const endpoint = ENDPOINT_MAP[gen.activeTab]
      console.log(`[ChatGenerator] *** STARTING REQUEST ***`)
      console.log(`[ChatGenerator] Active tab: ${gen.activeTab}`)
      console.log(`[ChatGenerator] Endpoint: ${endpoint}`)
      console.log(`[ChatGenerator] JobId: ${job.id}`)
      console.log(`[ChatGenerator] Job data:`, job)
      
      // Add timeout to detect hanging requests
      // Music generation takes longer (30-90 seconds), so use 5 minute timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 minute timeout for music
      
      console.log(`[ChatGenerator] Making fetch request...`)
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ jobId: job.id }),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      console.log(`[ChatGenerator] Response status: ${resp.status}`)
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
      gen.updateMessage(gen.activeTab, assistantPlaceholder.id, {
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
            
            // Show success toast notification with special message for first-time users
            const contentType = meta.resultType === 'image' ? 'Image' : meta.resultType === 'video' ? 'Video' : 'Music'
            
            if (shouldHighlightGenerate && !profile.tutorial_completed) {
              // First-time user - show special encouragement message
              const remainingCredits = profile.credits - 1 // They just used 1
              toast.success('🔥 That\'s your first AI-generated ad!', {
                description: `Try another — you've got ${remainingCredits} free ${remainingCredits === 1 ? 'image' : 'images'} left.`,
                duration: 6000,
              })
            } else {
              // Regular success message
              toast.success(`${contentType} generated successfully! 🎉`, {
                description: 'Your content is ready to view',
                duration: 5000,
              })
            }
            
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

            // For music, also get cover URL if available
            let coverUrl = ''
            if (meta.resultType === 'music' && statusData.cover_url) {
              console.log(`[ChatGenerator] 🎨 Creating cover signed URL...`)
              const { data: coverSignedUrl } = await supabase.storage
                .from('results')
                .createSignedUrl(statusData.cover_url, 3600)
              
              if (coverSignedUrl?.signedUrl) {
                coverUrl = coverSignedUrl.signedUrl
                console.log(`[ChatGenerator] 🎨 Cover URL: ${coverUrl}`)
              }
            }

            console.log(`[ChatGenerator] 📝 Updating message with data:`, {
              messageId: assistantPlaceholder.id,
              activeTab: gen.activeTab,
              status: 'complete',
              content: meta.resultType === 'image' ? 'Image generated ✅' : meta.resultType === 'video' ? 'Video generated ✅' : 'Music generated ✅',
              mediaUrl,
              coverUrl: coverUrl || undefined,
              mediaType: meta.resultType
            })

            const updateData: any = {
              status: 'complete',
              content: meta.resultType === 'image' ? 'Image generated ✅' : meta.resultType === 'video' ? 'Video generated ✅' : 'Music generated ✅',
              mediaUrl,
              mediaType: meta.resultType
            }

            if (coverUrl) {
              updateData.coverUrl = coverUrl
            }

            gen.updateMessage(gen.activeTab, assistantPlaceholder.id, updateData)
            
            console.log(`[ChatGenerator] ✅ MESSAGE UPDATE COMPLETED!`)
            console.log(`[ChatGenerator] 🎯 Final message should show image with URL: ${mediaUrl}`)
            
            // Refresh profile to get updated credit count
            console.log(`[ChatGenerator] 💳 Refreshing profile to get updated credits...`)
            try {
              const { data: updatedProfile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single()
              
              if (updatedProfile) {
                console.log(`[ChatGenerator] 💳 Credits updated: ${profile.credits} → ${updatedProfile.credits}`)
                // Update the local profile object to reflect new credit count
                Object.assign(profile, updatedProfile)
              }
            } catch (err) {
              console.error(`[ChatGenerator] Failed to refresh profile:`, err)
            }
            
            // Clear all active timeouts
            activeTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId))
            activeTimeouts.current.clear()
            
            // Make sure to reset generating state
            gen.setIsGenerating(false)
            console.log(`[ChatGenerator] 🔄 isGenerating set to false`)
            return
          }

          if (statusData.status === 'failed') {
            // Show error toast notification
            toast.error('Generation failed', {
              description: statusData.error || 'An error occurred during generation',
              duration: 5000,
            })
            
            // Clear all active timeouts
            activeTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId))
            activeTimeouts.current.clear()
            gen.setIsGenerating(false)
            throw new Error(statusData.error || 'Generation failed')
          }

          // Still processing, continue polling
          gen.updateMessage(gen.activeTab, assistantPlaceholder.id, {
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
          gen.updateMessage(gen.activeTab, assistantPlaceholder.id, {
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
      
      gen.updateMessage(gen.activeTab, assistantPlaceholder.id, {
        status: 'error',
        content: errorMessage
      })
    } finally {
      gen.setIsGenerating(false)
      setIsSubmitting(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendPrompt()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Credit Popup */}
      {showCreditPopup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-gray-900">⚠️ Insufficient Credits</h2>
                <p className="text-sm text-gray-500 mt-1">
                  You need {meta.resultType === 'video' ? '8' : meta.resultType === 'music' ? '3' : '1'} credits but only have {profile.credits}. Choose a plan to continue:
                </p>
              </div>
              <button
                onClick={() => setShowCreditPopup(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Plans Grid */}
            <PricingPlans 
              onSubscribeAction={handleSubscribe}
              isLoading={isUpgrading}
              variant="popup"
            />

            {/* Footer */}
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-2xl">
              <p className="text-xs text-gray-500 text-center">
                💳 Secure payment powered by Stripe • Cancel anytime • 30-day money-back guarantee
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="flex justify-between items-center border-b border-gray-200 bg-white px-6 py-3 flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-gray-800">{meta.title}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{meta.subtitle}</p>
        </div>
        <div className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1.5 rounded-full font-medium shadow-sm">
          ⭐ {getCreditText()}
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
          const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
          if (files.length > 0) {
            setLocalFiles(prevFiles => [...prevFiles, ...files])
            const newPreviews = files.map(f => URL.createObjectURL(f))
            setLocalPreviews(prevPreviews => [...prevPreviews, ...newPreviews])
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
              ) : isMusicMode ? (
                <>
                  <div className="text-5xl mb-4">🎵</div>
                  <h3 className="text-base font-semibold text-gray-800 mb-2">Describe Your Music</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Describe the style, mood, instruments, tempo, and feeling. Include genre, energy level, and specific musical elements you want.
                  </p>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs text-gray-400">
                      Example: "Upbeat rock song with electric guitars and powerful drums, energetic and motivational"
                    </p>
                    <div className="bg-purple-50 border border-purple-200 px-3 py-1 rounded-xl">
                      <span className="text-xs font-medium text-purple-700">3 credits per music</span>
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
                <div className="mt-3 w-[260px] h-[170px] rounded-lg bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 relative overflow-hidden border border-purple-200/50">
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
              {m.mediaUrl && m.mediaType === 'music' && (
                <div className="mt-3 relative group">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg overflow-hidden max-w-[500px]">
                    {/* Cover Image */}
                    {m.coverUrl && (
                      <div className="relative w-full aspect-square">
                        <Image
                          src={m.coverUrl}
                          alt="Music Cover Art"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    )}
                    
                    {/* Music Info and Player */}
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                          <span className="text-2xl">🎵</span>
                        </div>
                        <div className="flex-1 text-white">
                          <div className="font-semibold">Generated Music</div>
                          <div className="text-xs opacity-90">AI-Generated Audio</div>
                        </div>
                      </div>
                      <audio 
                        src={m.mediaUrl} 
                        controls 
                        className="w-full"
                      />
                    </div>
                  </div>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={async () => {
                        try {
                          const response = await fetch(m.mediaUrl!)
                          const blob = await response.blob()
                          const url = window.URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `generated-music-${Date.now()}.mp3`
                          document.body.appendChild(a)
                          a.click()
                          window.URL.revokeObjectURL(url)
                          document.body.removeChild(a)
                        } catch (e) {
                          console.error('Download failed:', e)
                        }
                      }}
                      className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full text-sm transition-colors"
                      title="Download music"
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
        <div className="flex gap-2 overflow-x-auto text-xs text-gray-600 pb-1 hide-scrollbar pr-4">
          {EXAMPLES[gen.activeTab].map(ex => (
            <button
              key={ex.short}
              onClick={() => handleExample(ex.full)}
              className="px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition text-gray-600 whitespace-nowrap border border-gray-200 hover:border-gray-300"
              title={ex.full}
            >
              {ex.short}
            </button>
          ))}
        </div>
        
        {/* Music-specific options */}
        {isMusicMode && (
          <div className="flex flex-col gap-3 p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200/50">
            {/* Row 1: Instrumental Toggle & Duration */}
            <div className="flex items-center justify-between gap-4">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={makeInstrumental}
                    onChange={(e) => setMakeInstrumental(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </div>
                <span className="text-sm font-medium text-gray-700">
                  🎹 Instrumental Only (no vocals)
                </span>
              </label>

              {/* Duration selector inline */}
              <div className="flex gap-1 items-center">
                <span className="text-xs text-gray-600 font-medium mr-1">⏱️ Duration:</span>
                {[10, 30, 60, 120, 180].map(duration => (
                  <button
                    key={duration}
                    onClick={() => setMusicDuration(duration as 10 | 30 | 60 | 120 | 180)}
                    className={`text-xs px-2.5 py-1 rounded-md transition ${
                      musicDuration === duration 
                        ? 'bg-purple-600 text-white font-semibold' 
                        : 'bg-white/80 text-gray-600 hover:bg-white border border-purple-200'
                    }`}
                  >
                    {duration < 60 ? `${duration}s` : `${duration / 60}m`}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Row 2: Genre Tags */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">
                🏷️ Genre/Style Tags <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={musicTags}
                onChange={(e) => setMusicTags(e.target.value)}
                placeholder="e.g., rock, pop, electronic, jazz, ambient"
                className="text-sm border border-purple-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white/80 placeholder:text-gray-400"
              />
              <p className="text-xs text-gray-500 mt-0.5">
                Add specific genres or styles to guide the music generation
              </p>
            </div>
            
            {/* Row 3: Lyrics Mode Selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600">
                ✍️ Lyrics
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLyricsMode('ai')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    lyricsMode === 'ai'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-white/80 text-gray-600 hover:bg-white border border-purple-200'
                  }`}
                >
                  🤖 AI Generate
                </button>
                <button
                  type="button"
                  onClick={() => setLyricsMode('custom')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    lyricsMode === 'custom'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-white/80 text-gray-600 hover:bg-white border border-purple-200'
                  }`}
                >
                  📝 Paste Your Own
                </button>
              </div>
              
              {lyricsMode === 'ai' ? (
                <p className="text-xs text-gray-500 mt-0.5">
                  AI will generate lyrics based on your prompt and genre
                </p>
              ) : (
                <>
                  <textarea
                    value={customLyrics}
                    onChange={(e) => setCustomLyrics(e.target.value)}
                    placeholder="Paste your lyrics here (verse, chorus, bridge, etc.)"
                    className="text-sm border border-purple-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white/80 resize-y min-h-[80px] placeholder:text-gray-400 mt-1"
                  />
                  <p className="text-xs text-gray-500">
                    Enter your own lyrics - the music will match your words
                  </p>
                </>
              )}
            </div>
            
            {/* Row 4: Cover Image Prompt */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">
                🎨 Cover Image Prompt <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={coverPrompt}
                onChange={(e) => setCoverPrompt(e.target.value)}
                placeholder="e.g., Sunset over ocean waves, vibrant colors..."
                className="text-sm border border-purple-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white/80 placeholder:text-gray-400"
              />
              <p className="text-xs text-gray-500 mt-0.5">
                Customize the cover art appearance (leave empty for automatic generation based on music style)
              </p>
            </div>
          </div>
        )}
        
        {/* Quick controls - only show aspect ratio for images/videos */}
        {!isMusicMode && (
          <div className="flex justify-center gap-4 mb-3 flex-wrap">
            <div className="flex gap-3 items-center">
              {aspectOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => gen.setAspectRatio(opt.value)}
                  className={`flex items-center justify-center p-3 rounded-lg transition ${
                    gen.aspectRatio === opt.value 
                      ? 'bg-purple-50 border-2 border-purple-500' 
                      : 'border-2 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {/* Visual aspect ratio box */}
                  <div 
                    className={`rounded border-2 ${
                      gen.aspectRatio === opt.value ? 'border-purple-500 bg-purple-200' : 'border-gray-400 bg-gray-200'
                    } ${
                      opt.value === 'landscape' ? 'w-10 h-6' : 'w-6 h-10'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Prompt Row */}
        <div className="flex items-center gap-2">
          {requiresImage && (
            <>
              <button
                onClick={handleUploadClick}
                className="text-xl hover:opacity-80 cursor-pointer"
                title="Upload reference images"
              >📎</button>
              <input ref={fileInputRef} onChange={handleFileChange} type="file" accept="image/*" multiple className="hidden" />
              <div className="flex gap-2 flex-wrap">
                {localPreviews.map((preview, index) => (
                  <div key={index} className="relative group">
                    <Image src={preview} alt={`preview ${index + 1}`} width={40} height={40} className="rounded-md object-cover" />
                    <button
                      onClick={() => removeFile(index)}
                      className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove image"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={onKeyDown}
            placeholder={isMusicMode ? "Describe your music: style, mood, instruments, tempo..." : "Describe your idea or drop an image…"}
            rows={1}
            className="flex-1 border border-gray-300 rounded-2xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none overflow-hidden min-h-[40px] max-h-[120px]"
            style={{ height: '40px' }}
          />
          <button
            id="generateButton"
            onClick={async () => {
              if (shouldHighlightGenerate) {
                await handleFirstGeneration()
                // Refresh to get updated profile with tutorial_completed = true
                router.refresh()
              }
              sendPrompt()
            }}
            disabled={gen.isGenerating || isSubmitting || (requiresImage && localFiles.length === 0) || !input.trim()}
            className={`bg-gradient-to-r from-purple-500 to-pink-500 text-white px-5 py-2 rounded-full text-sm font-semibold hover:scale-[1.03] active:scale-[0.97] transition disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2`}
            style={shouldHighlightGenerate ? {
              animation: 'soft-glow-pulse 2s ease-in-out infinite'
            } : undefined}
          >
            <span>⚡ Generate</span>
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
              {getButtonCreditText()}
            </span>
          </button>
        </div>
      </div>

      {/* First-Time Onboarding */}
      {shouldShowOnboarding && (
        <FirstTimeOnboarding
          user={user}
          profile={profile}
          onCompleteAction={handleOnboardingComplete}
        />
      )}

      {/* Upgrade Prompt */}
      <UpgradePrompt
        isOpen={shouldShowUpgrade}
        onCloseAction={closeUpgradePrompt}
        onOpenPricingAction={() => {
          closeUpgradePrompt()
          setShowCreditPopup(true)
        }}
      />
    </div>
  )
}
