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
import OnboardingQuestionnaire from './OnboardingQuestionnaire'
import UpgradePrompt from './UpgradePrompt'
import { useOnboarding } from '@/hooks/useOnboarding'
import dynamic from 'next/dynamic'
import ProUpsellModal from './ProUpsellModal'

import ProDiscountModal from './ProDiscountModal'
import ModelSelector from './ModelSelector'
import { Icon } from '@/components/studio/StudioIcons'
import {
  trackMetaAddPaymentInfo,
  trackMetaInitiateCheckout,
  trackMetaSubscribedButtonClick,
} from '@/lib/meta-events'

// Older chat history was saved with emojis ("Image generated ✅") - show it clean.
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2705}\u{2728}\u{200D}\u{FE0F}]+\s?/gu
const cleanChatText = (text: string) =>
  (text || '').replace(EMOJI_RE, '').replace(/\b(Image|Video|Music) generated\b/, '$1 ready').trim()

// Generate UUID that works on both server and client
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for server-side or older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0
    const v = c == 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

interface ChatGeneratorProps {
  user: User
  profile: Profile
  onLockedFeature?: () => void
  onShowUpgrade?: () => void
}

// Supabase Edge Function endpoints
const SUPABASE_FUNCTIONS_BASE = 'https://cqnaooicfxqtnbuwsopu.supabase.co/functions/v1'

// One endpoint for every mode: the job row (result_type, has_images,
// aspect_ratio, music_options) tells the backend what to generate, and the
// backend - not the browser - decides pricing and free-tier rules.
const GENERATE_ENDPOINT = `${SUPABASE_FUNCTIONS_BASE}/generate`

const CHECK_JOB_STATUS_ENDPOINT = `${SUPABASE_FUNCTIONS_BASE}/check-job-status`

const TAB_META: Record<string, { title: string; subtitle: string; locked?: boolean; model: string; resultType: 'image' | 'video' | 'music' }> = {
  'text-to-image': { title: 'Create Image', subtitle: 'Generate product-ready visuals from ideas', model: 'gemini', resultType: 'image' },
  'image-to-image': { title: 'Image to Image', subtitle: 'Transform or restyle an input image', model: 'gemini', resultType: 'image' },
  'text-to-video': { title: 'Text to Video', subtitle: 'Bring concepts to motion with AI video', locked: true, model: 'veo3_fast', resultType: 'video' },
  'image-to-video': { title: 'Image to Video', subtitle: 'Animate a still into dynamic video', locked: true, model: 'veo3_fast', resultType: 'video' },
  'text-to-music': { title: 'Text to Music', subtitle: 'Create original music from text descriptions', locked: true, model: 'suno', resultType: 'music' },
}

const EXAMPLES: Record<string, Array<{ short: string; full: string }>> = {
  'text-to-image': [
    {
      short: 'Coffee Cup on Wooden Table',
      full: 'Ultra-detailed cinematic product photo of a double-walled glass coffee mug filled with creamy latte topped with intricate heart-shaped latte art foam, placed on a wet rustic wooden counter at sunrise, soft volumetric light through a foggy café window, gentle steam rising, shallow depth of field (50mm f/1.8), realistic micro-droplets on the glass, warm morning tones, crisp reflections, professional food photography, editorial style'
    },
    {
      short: 'Skincare Bottle with Water Splash',
      full: 'Ultra-detailed cinematic product photo of a premium skincare serum bottle on a rippled water surface with crystal-clear gel splashes frozen mid-air, soft morning spa ambience, diffused natural daylight, gentle mist and reflections, elegant pastel tones, minimalist luxury aesthetic, studio macro photography, 85mm lens, ultra high resolution, editorial beauty lighting'
    },
    {
      short: 'Sport Bottle in Motion',
      full: 'Ultra-detailed cinematic action shot of a dynamic sport water bottle mid-squeeze, crystal droplets suspended in air, illuminated by dramatic rim and back lighting, stadium tunnel background with subtle motion blur, vibrant energetic color grading, high-speed photography, 85mm lens, ultra-sharp focus, professional commercial lighting, editorial sports aesthetic'
    }
  ],

  'image-to-image': [
    {
      short: 'Moody Cyberpunk Neon Scene',
      full: 'Restyle this into a moody cyberpunk neon scene, rain-soaked surfaces, teal and magenta glow, cinematic contrast, atmospheric haze'
    },
    {
      short: 'Minimalist Scandinavian Aesthetic',
      full: 'Transform into a minimalist Scandinavian aesthetic: soft neutral tones, gentle indirect light, matte textures, editorial clarity'
    },
    {
      short: 'Bright Summer Beach Lifestyle',
      full: 'Convert to a bright summer beach lifestyle shot with warm golden hour lighting, subtle lens flare, airy composition'
    }
  ],

  'text-to-video': [
    {
      short: 'Street Interview in the City',
      full: '10 second cinematic street interview scene with a friendly reporter holding a microphone, asking a smiling passerby “What makes you happiest in life?” on a busy urban sidewalk. The passerby laughs and replies warmly, mentioning spending time with family. Natural city ambience with footsteps, crowd chatter, and light traffic. Soft daylight, shallow depth of field, authentic handheld motion, realistic dialogue audio, subtle background blur.'
    },
    {
      short: 'Talking Fox in Forest',
      full: '8 second whimsical cinematic shot of a red fox sitting in a misty forest clearing at sunrise, softly speaking in a calm, expressive voice about appreciating nature and peace — saying “Every dawn feels like a fresh start.” Gentle lip-sync animation, warm forest ambience with birds chirping and rustling leaves, soft golden-hour lighting, shallow depth of field, gentle camera dolly-in, natural color grading.'
    },
    {
      short: 'Misty Mountain Valley at Sunrise',
      full: '10 second ultra-realistic cinematic nature shot of a misty mountain valley at sunrise. Soft fog rolling through pine trees, sunlight beams scattering through clouds, occasional birds gliding through frame. No human sound — only gentle wind, distant birds, and ambient nature echo. Wide aerial view, natural color grading, cinematic stabilization, 8K film look.'
    }
  ],

  'image-to-video': [
    {
      short: 'Parallax Depth Reveal',
      full: 'Animate into a subtle 6s parallax reveal: foreground lifts gently, depth layers move at different speeds, soft ambient particles, cinematic ease in-out'
    },
    {
      short: 'Rotating Hero Product Motion',
      full: 'Create a seamless looping rotation with gentle perspective shift, premium product hero motion, soft ambient studio light transitions'
    },
    {
      short: 'Atmospheric Fog & Light Motion',
      full: 'Add dynamic atmospheric motion: drifting fog layers, gentle light shifts, subtle camera push forward, premium film tone'
    }
  ],

  'text-to-music': [
    {
      short: 'Country Love Song – Sunset Bar',
      full: 'Country-style song about a man and woman falling in love at a small-town bar during sunset. Start soft with acoustic guitar and warm vocals, build up to a heartfelt chorus with fiddle and drums, then fade into gentle steel guitar. Include romantic storytelling lyrics like: “She smiled through the dust and neon light.”'
    },
    {
      short: 'Country Duet – Long Drive Home',
      full: 'Country duet between a man and woman driving home under moonlight after their first date. Begin with slow acoustic strumming, add light percussion and harmony on the second verse, final chorus introduces pedal steel and vocal layering. Include simple love lyrics like: “Every mile, your hand in mine feels like forever.”'
    },
    {
      short: 'Image2Ad.com Jingle – One Click Creation',
      full: 'Upbeat catchy commercial jingle for Image2Ad.com. Fun pop-country rhythm with claps, guitar, and light synths. Vocals sing a short memorable hook: “At Image2Ad dot com — make your vision come alive, with just one click and you’re ready to shine!” Include cheerful melody, tagline repeats at the end, and smooth beat transitions showing the AI can create images, videos, and songs in seconds.'
    }
  ]
}

export default function ChatGenerator({ user, profile, onLockedFeature, onShowUpgrade }: ChatGeneratorProps) {
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

  const [showProDiscountModal, setShowProDiscountModal] = useState(false)
  const [showProUpsellModal, setShowProUpsellModal] = useState(false)
  const [isUpgrading, setIsUpgrading] = useState<string | null>(null)
  const hasShownLastCreditModal = useRef(false) // Prevent multiple modals in same session
  const hasShownFirstGenModal = useRef(false) // Track if we've shown the 20% discount modal
  const hasCheckedProUpsell = useRef(false) // Track if we've checked for pro upsell eligibility
  const [hasActiveDiscount, setHasActiveDiscount] = useState(false)

  // Check for active discount on mount
  useEffect(() => {
    const checkDiscount = async () => {
      try {
        const response = await fetch('/api/pro-discount-status')
        const data = await response.json()
        setHasActiveDiscount(data.is_valid && !data.discount_never_activated)
      } catch (err) {
        console.error('Failed to check discount:', err)
      }
    }

    checkDiscount()

    // Re-check every 30 seconds
    const interval = setInterval(checkDiscount, 30000)
    return () => clearInterval(interval)
  }, [])

  // Onboarding integration
  const {
    shouldShowOnboarding,
    shouldHighlightGenerate,
    shouldShowUpgrade,
    prefillPrompt,
    dismissOnboarding,
    handleSkipOnboarding,
    handleFirstGeneration,
    checkCreditsAndShowUpgrade,
    closeUpgradePrompt,
    tutorialMode
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

  // Bridges the onboarding wizard (upload or sample click) into the normal
  // send pipeline: stage the file/prompt into state, then let this effect -
  // which runs after the state commit - call sendPrompt() so it reads fresh
  // values instead of a stale closure from the click handler.
  const [pendingWizardSubmit, setPendingWizardSubmit] = useState(false)
  useEffect(() => {
    if (pendingWizardSubmit) {
      setPendingWizardSubmit(false)
      sendPrompt()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingWizardSubmit])

  const handleWizardSubmit = (file: File | null, prompt: string) => {
    dismissOnboarding()
    if (file) {
      setLocalFiles([file])
      setLocalPreviews([URL.createObjectURL(file)])
    } else {
      setLocalFiles([])
      setLocalPreviews([])
    }
    setInput(prompt)
    setPendingWizardSubmit(true)
  }

  // Fire-and-forget: tells the server a generation just completed for this
  // user. Safe to call from all 3 independent completion-detection paths for
  // every generation (not just the first) - the route's atomic DB guard
  // means only the user's true first-ever completion actually logs the event
  // and fires Meta CAPI; every other call is a harmless no-op.
  const notifyFirstGenerationCompleted = () => {
    fetch('/api/first-generation-completed', { method: 'POST', keepalive: true }).catch(() => {})
  }

  // Music-specific options
  const [makeInstrumental, setMakeInstrumental] = useState(false)
  const [musicTags, setMusicTags] = useState('')
  const [lyricsMode, setLyricsMode] = useState<'ai' | 'custom'>('ai') // 'ai' = AI generates lyrics, 'custom' = user provides
  const [customLyrics, setCustomLyrics] = useState('')
  const [musicDuration, setMusicDuration] = useState<10 | 30 | 60 | 120 | 180>(30) // Duration in seconds
  const [coverPrompt, setCoverPrompt] = useState('') // Optional custom prompt for cover image
  const DEFAULT_VISIBLE_MESSAGES = 10
  const [visibleCounts, setVisibleCounts] = useState<Record<typeof gen.activeTab, number>>({
    'text-to-image': DEFAULT_VISIBLE_MESSAGES,
    'image-to-image': DEFAULT_VISIBLE_MESSAGES,
    'text-to-video': DEFAULT_VISIBLE_MESSAGES,
    'image-to-video': DEFAULT_VISIBLE_MESSAGES,
    'text-to-music': DEFAULT_VISIBLE_MESSAGES,
  })

  // Model selection for image generation (text-to-image and image-to-image only)
  const [selectedModel, setSelectedModel] = useState<'nano-banana' | 'nano-banana-pro'>('nano-banana')
  const [selectedResolution, setSelectedResolution] = useState<'1K' | '2K' | '4K'>('2K') // Default to 2K for Pro model

  const meta = TAB_META[gen.activeTab]
  const history = gen.histories[gen.activeTab]
  const visibleCount = visibleCounts[gen.activeTab] || DEFAULT_VISIBLE_MESSAGES
  const visibleHistory = history.slice(Math.max(0, history.length - visibleCount))
  const canLoadMore = history.length > visibleCount
  const requiresImage = gen.activeTab === 'image-to-image' || gen.activeTab === 'image-to-video'
  const isMusicMode = gen.activeTab === 'text-to-music'
  const isImageMode = gen.activeTab === 'text-to-image' || gen.activeTab === 'image-to-image'
  // Video / music are subscriber features (also covers a null subscription_status)
  // Paid = active subscriber, or anyone who has ever paid (credit packs,
  // former subscribers spending leftover credits).
  const hasPaidAccess =
    profile?.subscription_status === 'active' ||
    profile?.subscription_status === 'trialing' ||
    (profile as { has_paid?: boolean } | null)?.has_paid === true
  const isLocked = !!meta.locked && !hasPaidAccess
  const chatContainerRef = useRef<HTMLDivElement | null>(null)

  // Helper to get credit text based on user type
  // Treat any status other than 'active' or 'trialing' as free
  const isPro = hasPaidAccess
  const isFreeUser = !isPro
  const hasPro = isPro

  console.log(`[ChatGenerator] User Status Debug:`, {
    status: profile?.subscription_status,
    isPro,
    isFreeUser
  })

  const getCreditText = () => {
    if (isFreeUser) {
      // Free plan: 3 free credits once per account (1 image = 1 credit).
      if (profile.credits > 3) return `${profile.credits} credits`
      if (profile.credits <= 0) return 'No free images left'
      return profile.credits === 1 ? '1 free image left' : `${profile.credits} free images left`
    }
    return `${profile.credits} credits`
  }

  const getButtonCreditText = () => {
    let count: number
    if (meta.resultType === 'music') {
      count = 3
    } else if (meta.resultType === 'video') {
      count = 8
    } else {
      // Image generation - check selected model
      count = isImageMode && selectedModel === 'nano-banana-pro' ? 6 : 1
    }

    if (isFreeUser && count === 1) {
      return '1 free image'
    }
    return `${count} credit${count > 1 ? 's' : ''}`
  }

  // Get credit cost for current mode and model selection
  const getCreditCost = () => {
    if (meta.resultType === 'music') return 3
    if (meta.resultType === 'video') return 8
    if (isImageMode && selectedModel === 'nano-banana-pro') return 6
    return 1
  }

  // Keep visible messages count in sync with history length per tab
  useEffect(() => {
    setVisibleCounts(prev => {
      const current = prev[gen.activeTab] ?? DEFAULT_VISIBLE_MESSAGES
      const next = history.length === 0
        ? DEFAULT_VISIBLE_MESSAGES
        : Math.min(history.length, Math.max(current, DEFAULT_VISIBLE_MESSAGES))
      if (next === current) return prev
      return { ...prev, [gen.activeTab]: next }
    })
  }, [gen.activeTab, history.length])

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior,
      })
    } else if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior })
    }
  }

  // Scroll when switching tabs
  useEffect(() => {
    scrollToBottom('auto')
  }, [gen.activeTab])

  // Scroll on new messages
  useEffect(() => {
    scrollToBottom(history.length > 0 ? 'smooth' : 'auto')
  }, [history.length, visibleHistory.length])

  const loadOlderMessages = () => {
    setVisibleCounts(prev => ({
      ...prev,
      [gen.activeTab]: Math.min(
        history.length,
        (prev[gen.activeTab] || DEFAULT_VISIBLE_MESSAGES) + DEFAULT_VISIBLE_MESSAGES
      )
    }))
    requestAnimationFrame(() => scrollToBottom('auto'))
  }

  const handleSubscribe = async (plan: 'starter' | 'pro' | 'business', couponId?: string, interval: 'month' | 'year' = 'month') => {
    setIsUpgrading(plan)
    const metaOptions = {
      plan,
      couponId,
      source: 'generator_inline_pricing',
    }
    trackMetaSubscribedButtonClick(metaOptions)
    try {
      // 🚀 Track TikTok InitiateCheckout event
      try {
        await fetch('/api/tiktok-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'InitiateCheckout',
            contentId: plan,
            contentName: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
          }),
        });
        console.log(`✅ TikTok InitiateCheckout event tracked for ${plan} plan`);
      } catch (tikTokError) {
        console.error('❌ Failed to track TikTok InitiateCheckout:', tikTokError)
      }

      trackMetaInitiateCheckout(metaOptions)

      // Create checkout session via API
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan,
          interval,
          successUrl: `${window.location.origin}/billing?success=true`,
          cancelUrl: `${window.location.origin}${window.location.pathname}?checkout=cancelled`,
          // Apply discount if active and Pro plan
          ...(hasActiveDiscount && plan === 'pro' && { applyProDiscount: true })
        }),
      })

      if (response.ok) {
        const { url } = await response.json()
        trackMetaAddPaymentInfo(metaOptions)
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
            tabKey = job.result_type === 'video' ? 'image-to-video' : 'text-to-image' // Merge image-to-image into text-to-image
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
                content: job.status === 'completed' ? `${job.result_type === 'video' ? 'Video' : 'Image'} ready` :
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
          console.error(`⏱️ Polling timeout after ${Math.round(elapsed / 1000)}s for job ${jobId}`)
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
        console.log(`🔍 Polling job ${jobId}: status=${jobStatus.status}, elapsed=${Math.round(elapsed / 1000)}s`)

        if (jobStatus.status === 'completed' && jobStatus.result_url) {
          notifyFirstGenerationCompleted()

          // Show success toast notification
          const contentType = tab.includes('video') ? 'Video' : tab.includes('music') ? 'Music' : 'Image'
          toast.success(`${contentType} generated successfully!`, {
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
              content: `${tab.includes('video') ? 'Video' : tab.includes('music') ? 'Music' : 'Image'} ready`,
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

          // Check for upsell modals for free users
          if (isFreeUser) {
            try {
              // Refresh profile to get updated total_generations count
              const { data: updatedProfile } = await supabase
                .from('profiles')
                .select('total_generations')
                .eq('id', user.id)
                .single()

              if (updatedProfile) {
                const totalGens = updatedProfile.total_generations || 0
                console.log(`[ChatGenerator] ✅ Generation complete! total_generations: ${totalGens}`)

                // Show Pro Discount Modal (20% off for 15min) after 1st generation
                if (totalGens === 1 && !hasShownFirstGenModal.current) {
                  console.log(`[ChatGenerator] 🎯 First generation complete! Showing 20% discount modal...`)
                  hasShownFirstGenModal.current = true
                  setTimeout(() => {
                    setShowProDiscountModal(true)
                  }, 3000)
                }
              }
            } catch (err) {
              console.error(`[ChatGenerator] Failed to check for upsells:`, err)
            }
          }
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
          console.log(`⏳ Job ${jobId} still ${jobStatus.status}, polling again in ${pollInterval / 1000}s...`)
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
    console.log(`🚀 Starting polling for job ${jobId} after ${initialDelay / 1000}s delay, max duration: ${maxDuration / 1000}s, poll interval: ${pollInterval / 1000}s`)
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

  // Collapsible controls state
  const [showAspectRatio, setShowAspectRatio] = useState(false)
  const [showMusicOptions, setShowMusicOptions] = useState(false)
  const [showModelSelector, setShowModelSelector] = useState(false)

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
    const requiredCredits = getCreditCost()
    if (profile.credits < requiredCredits && isFreeUser) {
      // A tab left open past midnight shows yesterday's balance: top up
      // today's free credits before deciding (the server does the same).
      const { data: refreshed } = await supabase.rpc('refill_my_free_credits')
      if (typeof refreshed === 'number') Object.assign(profile, { credits: refreshed })
    }
    if (profile.credits < requiredCredits) {
      console.log(`[ChatGenerator] Blocked: Insufficient credits (have: ${profile.credits}, need: ${requiredCredits})`)

      // Check if this is a free user who ran out of credits - show upgrade prompt
      if (checkCreditsAndShowUpgrade()) {
        // Upgrade prompt will be shown
        return
      }

      // Subscriber out of credits
      toast.error('Not enough credits', {
        description: `This needs ${requiredCredits} credit${requiredCredits === 1 ? '' : 's'} and you have ${profile.credits}.`,
        action: { label: 'Get credits', onClick: () => router.push('/billing') },
        duration: 6000,
      })
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
      content: shouldHighlightGenerate ? 'Brewing your ad...' : 'Generating…',
      createdAt: Date.now(),
      status: 'pending'
    }
    gen.pushMessage(gen.activeTab, assistantPlaceholder)

    // If this is the first generation, show animated progress messages
    if (shouldHighlightGenerate) {
      const messages = [
        'Brewing your ad...',
        'Adding the perfect lighting...',
        'Capturing the final shot...',
        'Almost ready...'
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
      // Allow upload if files exist, regardless of mode (supports text-to-image with reference)
      if (localFiles.length > 0) {
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
          import('@/lib/analytics').then(({ track }) => track('image_uploaded', { source: 'chat_generator' })).catch(() => {})

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
      console.log(`[ChatGenerator] 🎯 ASPECT RATIO CHECK - gen.aspectRatio value:`, gen.aspectRatio)
      const jobPayload: any = {
        user_id: user.id,
        model: meta.model,
        prompt: userMsg.content,
        status: 'pending',
        result_type: meta.resultType,
        has_images: imageIds.length > 0,
        image_ids: imageIds,
        image_id: imageIds.length > 0 ? imageIds[0] : null,
        aspect_ratio: gen.aspectRatio // Aspect ratio passed separately for all modes
      }

      console.log(`[ChatGenerator] 🎯 Job payload aspect_ratio:`, jobPayload.aspect_ratio)
      console.log(`[ChatGenerator] Full job payload:`, JSON.stringify(jobPayload, null, 2))


      // Add music-specific parameters
      if (isMusicMode) {
        jobPayload.music_options = {
          make_instrumental: makeInstrumental,
          lyrics_mode: lyricsMode,
          // When custom lyrics mode, use the main input field content as lyrics word-for-word
          custom_lyrics: lyricsMode === 'custom' ? input.trim() : undefined,
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

      const endpoint = GENERATE_ENDPOINT

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
      const requestBody: any = { jobId: job.id }

      // Add model parameter for image generation modes
      if (isImageMode) {
        requestBody.model = selectedModel
        // Add resolution for Pro model
        if (selectedModel === 'nano-banana-pro') {
          requestBody.resolution = selectedResolution
          console.log(`[ChatGenerator] Selected model: ${selectedModel}, Resolution: ${selectedResolution}`)
        } else {
          console.log(`[ChatGenerator] Selected model: ${selectedModel}`)
        }
      }

      // The edge functions authorize the caller as the owner of the job, so
      // they need the user's session token - the anon key is not accepted.
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Your session expired. Please sign in again.')
      }

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      console.log(`[ChatGenerator] Response status: ${resp.status}`)
      console.log(`[ChatGenerator] Response headers:`, Object.fromEntries(resp.headers.entries()))
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}))
        console.error(`[ChatGenerator] API Response Error for ${gen.activeTab}:`, resp.status, errData)
        console.error(`[ChatGenerator] Response headers:`, Object.fromEntries(resp.headers.entries()))
        // Out of today's free images (or credits) - offer the upgrade
        if (resp.status === 402 && isFreeUser) checkCreditsAndShowUpgrade()
        throw new Error(errData.error || `HTTP ${resp.status}: Generation failed`)
      }
      const responseData = await resp.json()
      console.log(`[ChatGenerator] Response from ${gen.activeTab}:`, responseData)

      if (!responseData.success) {
        throw new Error(responseData.error || 'Generation failed')
      }

      // Task created successfully, now subscribe to realtime updates
      gen.updateMessage(gen.activeTab, assistantPlaceholder.id, {
        status: 'pending',
        content: 'Processing with AI...'
      })

      console.log(`[ChatGenerator] 🔔 Setting up realtime subscription for job ${job.id}`)

      // Subscribe to database changes for this specific job
      const channel = supabase
        .channel(`job-${job.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'jobs',
            filter: `id=eq.${job.id}`
          },
          async (payload) => {
            console.log(`[ChatGenerator] 🔔 Received realtime update for job ${job.id}:`, payload)
            const updatedJob = payload.new as any

            if (updatedJob.status === 'completed' && updatedJob.result_url) {
              console.log(`[ChatGenerator] 🎉 Job completed via realtime! Result: ${updatedJob.result_url}`)
              notifyFirstGenerationCompleted()

              // Unsubscribe from further updates
              channel.unsubscribe()

              // Show success notification
              const contentType = meta.resultType === 'image' ? 'Image' : meta.resultType === 'video' ? 'Video' : 'Music'
              if (shouldHighlightGenerate && !profile.tutorial_completed) {
                const remainingCredits = profile.credits - requiredCredits
                toast.success('That\'s your first AI-generated ad!', {
                  description: `Try another — you've got ${remainingCredits} free ${remainingCredits === 1 ? 'image' : 'images'} left today.`,
                  duration: 6000,
                })
              } else {
                toast.success(`${contentType} generated successfully!`, {
                  description: 'Your content is ready to view',
                  duration: 5000,
                })
              }

              // Get signed URL for the result
              const { data: signedUrl } = await supabase.storage
                .from('results')
                .createSignedUrl(updatedJob.result_url, 3600)

              const mediaUrl = signedUrl?.signedUrl || ''

              // For music, also get cover URL if available
              let coverUrl = ''
              if (meta.resultType === 'music' && updatedJob.cover_url) {
                const { data: coverSignedUrl } = await supabase.storage
                  .from('results')
                  .createSignedUrl(updatedJob.cover_url, 3600)

                if (coverSignedUrl?.signedUrl) {
                  coverUrl = coverSignedUrl.signedUrl
                }
              }

              // Update the message with the result
              gen.updateMessage(gen.activeTab, assistantPlaceholder.id, {
                status: 'complete',
                content: `${contentType} ready`,
                mediaUrl,
                mediaType: meta.resultType,
                coverUrl: coverUrl || undefined
              })

              gen.setIsGenerating(false)
              router.refresh()

              // Track first generation for onboarding
              if (shouldHighlightGenerate) {
                handleFirstGeneration()
              }
            } else if (updatedJob.status === 'failed') {
              console.error(`[ChatGenerator] ❌ Job failed:`, updatedJob.error_message)

              // Unsubscribe from further updates
              channel.unsubscribe()

              gen.updateMessage(gen.activeTab, assistantPlaceholder.id, {
                status: 'error',
                content: updatedJob.error_message || 'Generation failed. Please try again.'
              })

              gen.setIsGenerating(false)
            }
          }
        )
        .subscribe((status) => {
          console.log(`[ChatGenerator] 🔔 Realtime subscription status:`, status)
        })

      // CRITICAL: Start polling to actually check job status and update database
      // This calls check-job-status which polls Kie.ai and updates the DB
      console.log(`[ChatGenerator] 🚀 Starting polling for job ${job.id}`)
      startJobPolling(gen.activeTab, assistantPlaceholder.id, job.id)

      // Fallback: If no update after 10 minutes, check manually once
      const fallbackTimeout = setTimeout(async () => {
        console.log(`[ChatGenerator] ⏰ Fallback timeout reached, checking job status manually...`)
        const pollForResult = async (): Promise<void> => {
          try {
            const { data: { session: pollSession } } = await supabase.auth.getSession()
            if (!pollSession?.access_token) {
              console.error('[ChatGenerator] No session for fallback status check')
              return
            }

            const statusResp = await fetch(`${CHECK_JOB_STATUS_ENDPOINT}?jobId=${job.id}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${pollSession.access_token}`,
                'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
              }
            })

            if (!statusResp.ok) {
              throw new Error(`Status check failed: ${statusResp.status}`)
            }

            const statusData = await statusResp.json()

            if (statusData.status === 'completed' && statusData.result_url) {
              console.log(`[ChatGenerator] 🎉 GENERATION COMPLETED! Result URL: ${statusData.result_url}`)
              notifyFirstGenerationCompleted()

              // Show success toast notification with special message for first-time users
              const contentType = meta.resultType === 'image' ? 'Image' : meta.resultType === 'video' ? 'Video' : 'Music'

              if (shouldHighlightGenerate && !profile.tutorial_completed) {
                // First-time user - show special encouragement message
                const remainingCredits = profile.credits - 1 // They just used 1
                toast.success('That\'s your first AI-generated ad!', {
                  description: `Try another — you've got ${remainingCredits} free ${remainingCredits === 1 ? 'image' : 'images'} left today.`,
                  duration: 6000,
                })
              } else {
                // Regular success message
                toast.success(`${contentType} generated successfully!`, {
                  description: 'Your content is ready to view',
                  duration: 5000,
                })
              }

              // Create signed URL - same as library does
              const { data: signedUrl } = await supabase.storage
                .from('results')
                .createSignedUrl(statusData.result_url, 3600)


              const mediaUrl = signedUrl?.signedUrl || ''

              if (!mediaUrl) {
                console.error(`[ChatGenerator] ❌ NO MEDIA URL - CANNOT SHOW IMAGE!`)
                console.error(`[ChatGenerator] signedUrl:`, signedUrl)
                console.error(`[ChatGenerator] statusData:`, statusData)
              }

              // For music, also get cover URL if available
              let coverUrl = ''
              if (meta.resultType === 'music' && statusData.cover_url) {
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
                content: meta.resultType === 'image' ? 'Image ready' : meta.resultType === 'video' ? 'Video ready' : 'Music ready',
                mediaUrl,
                coverUrl: coverUrl || undefined,
                mediaType: meta.resultType
              })

              const updateData: any = {
                status: 'complete',
                content: meta.resultType === 'image' ? 'Image ready' : meta.resultType === 'video' ? 'Video ready' : 'Music ready',
                mediaUrl,
                mediaType: meta.resultType
              }

              if (coverUrl) {
                updateData.coverUrl = coverUrl
              }

              gen.updateMessage(gen.activeTab, assistantPlaceholder.id, updateData)

              console.log(`[ChatGenerator] ✅ MESSAGE UPDATE COMPLETED!`)

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

                  // Refresh the router to update credits display in sidebar and other components
                  router.refresh()

                  // Check if user has 1 credit left (trigger Pro upsell modal)
                  if (updatedProfile.credits === 1 && profile.tutorial_completed && !hasCheckedProUpsell.current) {
                    console.log(`[ChatGenerator] 🎯 User has 1 credit left! Activating Pro discount...`)
                    hasCheckedProUpsell.current = true

                    // IMMEDIATELY activate the discount by calling POST
                    setTimeout(async () => {
                      try {
                        // First check if discount already exists
                        const checkResponse = await fetch('/api/pro-discount-status')
                        const checkData = await checkResponse.json()

                        if (checkData.discount_never_activated) {
                          // Activate discount NOW (set expiry timestamp in Supabase)
                          console.log(`[ChatGenerator] 🎬 Activating Pro discount for the first time!`)
                          const activateResponse = await fetch('/api/pro-discount-status', {
                            method: 'POST'
                          })

                          if (activateResponse.ok) {
                            console.log(`[ChatGenerator] ✅ Pro discount activated! Showing modal...`)
                            setShowProUpsellModal(true)
                          } else {
                            console.error(`[ChatGenerator] ❌ Failed to activate discount`)
                          }
                        } else if (checkData.is_valid) {
                          // Discount already active and still valid
                          console.log(`[ChatGenerator] ⏰ Pro discount already active, showing modal...`)
                          setShowProUpsellModal(true)
                        } else {
                          console.log(`[ChatGenerator] ⏱️ Pro discount expired, not showing modal`)
                        }
                      } catch (err) {
                        console.error(`[ChatGenerator] Failed to activate Pro discount:`, err)
                      }
                    }, 2000)
                  }

                  // Check if user just used their last credit and show upgrade modal
                  if (updatedProfile.credits === 0 && !hasShownLastCreditModal.current) {
                    console.log(`[ChatGenerator] 🎉 Last free credit used! Showing upgrade popup...`)
                    hasShownLastCreditModal.current = true
                    // Wait 3 seconds (after toast appears) then show the upgrade modal
                    setTimeout(() => {
                      console.log(`[ChatGenerator] 💳 Showing upgrade popup`)
                      setShowCreditPopup(true)
                    }, 3000)
                  }
                }
              } catch (err) {
                console.error(`[ChatGenerator] Failed to refresh profile:`, err)
              }

              // Clear all active timeouts (except the wheel/popup timeout which is not tracked)
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

          } catch (error) {
            console.error('[ChatGenerator] Fallback polling error:', error)
          }
        }

        // Execute fallback once
        pollForResult()
      }, 600000) // 10 minutes

      activeTimeouts.current.add(fallbackTimeout)
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
    <div className="sc-root flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Tutorial Dark Overlay - covers everything */}
      {shouldHighlightGenerate && (
        <div className="fixed inset-0 bg-black/60 z-[9999] pointer-events-none" />
      )}

      {/* Pro Upsell Modal (20% discount for 15 minutes) */}
      {showProUpsellModal && (
        <ProUpsellModal
          onCloseAction={() => setShowProUpsellModal(false)}
          onUpgradeAction={async () => {
            // Redirect to billing page with promo parameter
            window.location.href = '/billing?promo=pro20limited'
          }}
        />
      )}

      {/* Credit Popup - DISABLED: Now handled by DashboardLayout with new ProDiscountModal and ProTrialModal */}
      {/* {showCreditPopup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-2xl">
              <div>
                {profile.credits === 0 && hasShownLastCreditModal.current ? (
                  <>
                    <h2 className="text-xl font-bold text-gray-900">🎉 You've Used Today's 3 Free Images!</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      They refill tomorrow — or upgrade now for more HD generations, faster rendering, and video & music creation.
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-xl font-bold text-gray-900">⚠️ Insufficient Credits</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      You need {meta.resultType === 'video' ? '8' : meta.resultType === 'music' ? '3' : '1'} credits but only have {profile.credits}. Choose a plan to continue:
                    </p>
                  </>
                )}
              </div>
              <button
                onClick={() => setShowCreditPopup(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <PricingPlans 
              onSubscribeAction={handleSubscribe}
              isLoading={isUpgrading}
              variant="popup"
              discountPercentage={hasActiveDiscount ? 20 : undefined}
              couponId={hasActiveDiscount ? 'VbLhruZu' : undefined}
            />

            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-2xl">
              <p className="text-xs text-gray-500 text-center">
                💳 Secure payment powered by Stripe • Cancel anytime • 30-day money-back guarantee
              </p>
            </div>
          </div>
        </div>
      )} */}

      {/* Header */}
      <div className="sc-header">
        <div className="sc-header-title">
          <h1>{meta.title}</h1>
          <p>{meta.subtitle}</p>
        </div>
        <div className="sc-header-actions">
          {/* Upgrade Button - Always visible for free users */}
          {isFreeUser && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                // Opens the paywall (yearly plans + packs)
                if (onShowUpgrade) {
                  onShowUpgrade()
                } else {
                  console.warn('onShowUpgrade not available, using fallback')
                  onLockedFeature?.()
                }
              }}
              className="sc-upgrade"
              title="See plans"
            >
              <Icon name="spark" />
              Upgrade
            </button>
          )}

          {/* Credits Pill - Only show for paid users */}
          {!isFreeUser && (
            <button
              onClick={() => {
                onLockedFeature?.()
              }}
              className="sc-credits"
              title="Click to get more credits"
            >
              <span className="sc-credits-dot" />
              {getCreditText()}
            </button>
          )}
        </div>
      </div>

      {/* Scrollable chat body */}
      <div
        ref={chatContainerRef}
        className="sc-body"
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
          <div className="sc-dropzone">
            <div>
              <Icon name="upload" />
              Drop your reference image here
            </div>
          </div>
        )}
        {history.length === 0 && (
          <div className="sc-empty-wrap">
            <div
              onClick={requiresImage ? handleUploadClick : undefined}
              className={`sc-empty ${requiresImage ? 'is-upload' : ''}`}
            >
              {requiresImage ? (
                <>
                  <span className="sc-empty-icon"><Icon name="upload" /></span>
                  <span className="sc-eyebrow">Step 1 · Your product</span>
                  <h3>Upload your product photo</h3>
                  <p>Click here or drag &amp; drop an image to start transforming it.</p>
                  <div className="sc-empty-foot">
                    <span>JPG or PNG · up to 10MB</span>
                    <span className="sc-chip">{gen.activeTab === 'image-to-video' ? '8 credits per video' : '1 credit per image'}</span>
                  </div>
                </>
              ) : gen.activeTab.includes('video') ? (
                <>
                  <span className="sc-empty-icon"><Icon name="video" /></span>
                  <span className="sc-eyebrow">Text to video</span>
                  <h3>Describe your video scene</h3>
                  <p>Describe motion, camera movement and style. Include how objects move and the mood of the shot.</p>
                  <div className="sc-empty-foot">
                    <span>&ldquo;8-second dolly shot of a perfume bottle rotating on marble, soft light&rdquo;</span>
                    <span className="sc-chip">8 credits per video</span>
                  </div>
                </>
              ) : isMusicMode ? (
                <>
                  <span className="sc-empty-icon"><Icon name="music" /></span>
                  <span className="sc-eyebrow">Text to music</span>
                  <h3>Describe your music</h3>
                  <p>Describe the style, mood, instruments, tempo and energy level.</p>
                  <div className="sc-empty-foot">
                    <span>&ldquo;Upbeat rock with electric guitars, energetic&rdquo;</span>
                    <span className="sc-chip">3 credits</span>
                  </div>
                </>
              ) : (
                <>
                  <span className="sc-empty-icon"><Icon name="spark" /></span>
                  <span className="sc-eyebrow">New ad</span>
                  <h3>Describe your vision</h3>
                  <p>Add a product photo below, then describe lighting, materials, mood, camera angle and style.</p>
                  <div className="sc-empty-foot">
                    <span>&ldquo;Luxury watch on a marble surface, dramatic lighting&rdquo;</span>
                    <span className="sc-chip">{selectedModel === 'nano-banana-pro' ? '6 credits' : '1 credit'}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {history.length > 0 && canLoadMore && (
          <div className="sc-load-more">
            <button onClick={loadOlderMessages}>
              Load previous {Math.min(DEFAULT_VISIBLE_MESSAGES, history.length - visibleHistory.length)} messages
            </button>
          </div>
        )}
        {visibleHistory.map(m => (
          <div key={m.id} className={`sc-row ${m.role === 'user' ? 'is-user' : 'is-assistant'}`}>
            {m.role !== 'user' && (
              <span className="sc-avatar" aria-hidden="true"><Icon name="spark" /></span>
            )}
            <div className={`sc-bubble ${m.role === 'user' ? 'is-user' : 'is-assistant'}`}>
              <div className="sc-bubble-text">
                {cleanChatText(m.content)}
              </div>
              {m.status === 'pending' && (
                <div className="sc-pending">
                  <div className="sc-pending-top">
                    <span className="sc-pending-dots"><i /><i /><i /></span>
                    <span className="sc-pending-time">{meta.resultType === 'video' ? '2–5 min' : '30–60 sec'}</span>
                  </div>
                  <div className="sc-pending-label">Generating {meta.resultType}</div>
                  <div className="sc-pending-bar"><span /></div>
                </div>
              )}
              {m.mediaUrl && m.mediaType === 'image' && (
                <div className="sc-media group">
                  <Image
                    // Free plan sees the watermarked preview (server-rendered)
                    src={isFreeUser && m.jobId ? `/api/download-image?jobId=${m.jobId}&inline=1` : m.mediaUrl}
                    alt="Generated result"
                    width={400}
                    height={400}
                    unoptimized
                    className="sc-media-img"
                    onClick={() => m.mediaUrl && window.open(isFreeUser && m.jobId ? `/api/download-image?jobId=${m.jobId}&inline=1` : m.mediaUrl, '_blank')}
                  />
                  <button
                    onClick={async () => {
                      try {
                        // Routed through the server so free-tier downloads get
                        // watermarked (original stays untouched)
                        const downloadUrl = m.jobId
                          ? `/api/download-image?jobId=${m.jobId}`
                          : m.mediaUrl!
                        const response = await fetch(downloadUrl)
                        const blob = await response.blob()
                        const url = window.URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `generated-image-${Date.now()}.png`
                        import('@/lib/analytics').then(({ track }) => track('result_downloaded', { media_type: 'image', source: 'chat' })).catch(() => {})
                        document.body.appendChild(a)
                        a.click()
                        window.URL.revokeObjectURL(url)
                        document.body.removeChild(a)
                      } catch (e) {
                        console.error('Download failed:', e)
                      }
                    }}
                    className="sc-download"
                    title="Download image"
                  >
                    <Icon name="download" />
                  </button>
                </div>
              )}
              {m.mediaUrl && m.mediaType === 'video' && (
                <div className="sc-media group">
                  <video
                    src={m.mediaUrl}
                    controls
                    className="sc-media-video"
                  />
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch(m.mediaUrl!)
                        const blob = await response.blob()
                        const url = window.URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `generated-video-${Date.now()}.mp4`
                        import('@/lib/analytics').then(({ track }) => track('result_downloaded', { media_type: 'video', source: 'chat' })).catch(() => {})
                        document.body.appendChild(a)
                        a.click()
                        window.URL.revokeObjectURL(url)
                        document.body.removeChild(a)
                      } catch (e) {
                        console.error('Download failed:', e)
                      }
                    }}
                    className="sc-download"
                    title="Download video"
                  >
                    <Icon name="download" />
                  </button>
                </div>
              )}
              {m.mediaUrl && m.mediaType === 'music' && (
                <div className="sc-media group">
                  <div className="sc-music">
                    {m.coverUrl && (
                      <div className="sc-music-cover">
                        <Image
                          src={m.coverUrl}
                          alt="Music cover art"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    )}
                    <div className="sc-music-body">
                      <div className="sc-music-head">
                        <span className="sc-music-icon"><Icon name="music" /></span>
                        <div>
                          <div className="sc-music-title">Generated music</div>
                          <div className="sc-music-sub">AI-generated audio</div>
                        </div>
                      </div>
                      <audio src={m.mediaUrl} controls className="w-full" />
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch(m.mediaUrl!)
                        const blob = await response.blob()
                        const url = window.URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `generated-music-${Date.now()}.mp3`
                        import('@/lib/analytics').then(({ track }) => track('result_downloaded', { media_type: 'music', source: 'chat' })).catch(() => {})
                        document.body.appendChild(a)
                        a.click()
                        window.URL.revokeObjectURL(url)
                        document.body.removeChild(a)
                      } catch (e) {
                        console.error('Download failed:', e)
                      }
                    }}
                    className="sc-download"
                    title="Download music"
                  >
                    <Icon name="download" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div
        className="sc-composer"
        style={shouldHighlightGenerate ? {
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
          position: 'relative',
          zIndex: shouldHighlightGenerate && !shouldShowOnboarding ? 10001 : 0
        } : {
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)'
        }}
      >
        {/* Local overlay for this section only - only show when highlight is active AND modal is closed */}
        {shouldHighlightGenerate && !shouldShowOnboarding && (
          <div className="absolute inset-0 bg-black/60 pointer-events-none" style={{ zIndex: 1 }} />
        )}

        <div className="sc-composer-inner">
          {/* Examples */}
          <div className="sc-examples scrollbar-hide">
            <span className="sc-examples-label">Try</span>
            {EXAMPLES[gen.activeTab].map(ex => (
              <button
                key={ex.short}
                onClick={() => handleExample(ex.full)}
                className="sc-example"
                title={ex.full}
              >
                {ex.short}
              </button>
            ))}
          </div>

          {/* Settings */}
          <div className="sc-settings">
            {(requiresImage || gen.activeTab === 'text-to-image') && (
              <button
                onClick={handleUploadClick}
                className={`sc-setting ${localFiles.length > 0 ? 'is-set' : ''} ${shouldHighlightGenerate && !shouldShowOnboarding && tutorialMode === 'product' && localFiles.length === 0
                  ? 'sc-highlight relative z-10'
                  : ''
                  }`}
                title="Upload reference images"
              >
                <Icon name="paperclip" />
                <span className="sc-setting-label">Photo</span>
                <span className="sc-setting-value">
                  {localFiles.length > 0 ? `${localFiles.length} image${localFiles.length > 1 ? 's' : ''}` : 'Add'}
                </span>
              </button>
            )}

            {!isMusicMode && (
              <button
                onClick={() => setShowAspectRatio(!showAspectRatio)}
                className={`sc-setting ${showAspectRatio ? 'is-open' : ''}`}
              >
                <Icon name="ratio" />
                <span className="sc-setting-label">Ratio</span>
                <span className="sc-setting-value">
                  {aspectOptions.find(opt => opt.value === gen.aspectRatio)?.label || '16:9'}
                </span>
                <Icon name="chevron" className="sc-chevron" />
              </button>
            )}

            {isImageMode && (
              <button
                onClick={() => setShowModelSelector(!showModelSelector)}
                className={`sc-setting ${showModelSelector ? 'is-open' : ''}`}
              >
                <Icon name="layers" />
                <span className="sc-setting-label">Model</span>
                <span className="sc-setting-value">
                  {selectedModel === 'nano-banana-pro' ? `Pro · ${selectedResolution}` : 'Standard'}
                </span>
                <Icon name="chevron" className="sc-chevron" />
              </button>
            )}

            {isMusicMode && (
              <button
                onClick={() => setShowMusicOptions(!showMusicOptions)}
                className={`sc-setting ${showMusicOptions ? 'is-open' : ''}`}
              >
                <Icon name="settings" />
                <span className="sc-setting-label">Options</span>
                <span className="sc-setting-value">
                  {musicDuration < 60 ? `${musicDuration}s` : `${musicDuration / 60}m`}
                  {makeInstrumental && ' · Instrumental'}
                  {musicTags && ' · ' + musicTags.split(',')[0].trim()}
                </span>
                <Icon name="chevron" className="sc-chevron" />
              </button>
            )}
          </div>

          {/* Aspect ratio panel */}
          {!isMusicMode && showAspectRatio && (
            <div className="sc-panel sc-ratios">
              {aspectOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => gen.setAspectRatio(opt.value)}
                  className={`sc-ratio ${gen.aspectRatio === opt.value ? 'is-active' : ''}`}
                >
                  <span className={`sc-ratio-shape ${opt.value === 'landscape' ? 'is-landscape' : 'is-portrait'}`} />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Model panel */}
          {isImageMode && showModelSelector && (
            <div className="sc-panel-plain">
              <ModelSelector
                selectedModel={selectedModel}
                onSelectModel={setSelectedModel}
                selectedResolution={selectedResolution}
                onSelectResolution={setSelectedResolution}
                disabled={isSubmitting || isLocked}
                isPro={hasPro}
                onShowUpgrade={onShowUpgrade}
              />
            </div>
          )}

          {/* Music panel */}
          {isMusicMode && showMusicOptions && (
            <div className="sc-panel sc-music-options">
              <div className="sc-field">
                <label>Duration</label>
                <div className="sc-segment">
                  {[10, 30, 60, 120, 180].map(duration => (
                    <button
                      key={duration}
                      onClick={() => setMusicDuration(duration as 10 | 30 | 60 | 120 | 180)}
                      className={musicDuration === duration ? 'is-active' : ''}
                    >
                      {duration < 60 ? `${duration}s` : `${duration / 60}m`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sc-field">
                <label>Lyrics</label>
                <div className="sc-segment">
                  <button
                    type="button"
                    onClick={() => setLyricsMode('ai')}
                    className={lyricsMode === 'ai' ? 'is-active' : ''}
                  >
                    AI writes them
                  </button>
                  <button
                    type="button"
                    onClick={() => setLyricsMode('custom')}
                    className={lyricsMode === 'custom' ? 'is-active' : ''}
                  >
                    My own
                  </button>
                </div>
                {lyricsMode === 'custom' && (
                  <p className="sc-hint">Type your lyrics in the message box below.</p>
                )}
              </div>

              <div className="sc-field">
                <label>Cover image <span>(optional)</span></label>
                <input
                  type="text"
                  value={coverPrompt}
                  onChange={(e) => setCoverPrompt(e.target.value)}
                  placeholder="Describe the cover art style…"
                  className="sc-input"
                />
              </div>
            </div>
          )}

          {/* Uploaded image previews */}
          {(requiresImage || gen.activeTab === 'text-to-image') && localPreviews.length > 0 && (
            <div className="sc-previews">
              {localPreviews.map((preview, index) => (
                <div key={index} className="sc-preview">
                  <Image src={preview} alt={`preview ${index + 1}`} width={56} height={56} className="sc-preview-img" />
                  <button
                    onClick={() => removeFile(index)}
                    className="sc-preview-remove"
                    title="Remove image"
                  >
                    <Icon name="close" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Hidden file input */}
          <input ref={fileInputRef} onChange={handleFileChange} type="file" accept="image/*" multiple className="hidden" />

          {/* Prompt row */}
          <div className="sc-prompt" style={{ zIndex: 2 }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={onKeyDown}
              placeholder={
                isMusicMode
                  ? (lyricsMode === 'custom'
                    ? "Paste your lyrics here (verse, chorus, etc.)..."
                    : "Describe your music: style, mood, instruments, tempo...")
                  : "Describe your ad, or drop a product photo…"
              }
              rows={1}
              className="sc-textarea"
              style={{ height: '44px' }}
            />
            <button
              id="generateButton"
              data-tutorial="generate-button"
              onClick={async () => {
                if (shouldHighlightGenerate) {
                  await handleFirstGeneration()
                  // Refresh to get updated profile with tutorial_completed = true
                  router.refresh()
                }
                sendPrompt()
              }}
              disabled={shouldHighlightGenerate ? false : (gen.isGenerating || isSubmitting || (requiresImage && localFiles.length === 0) || !input.trim())}
              className={`sc-send ${shouldHighlightGenerate ? 'sc-highlight' : ''}`}
              title={`Generate (${getButtonCreditText()})`}
            >
              <span className="sc-send-label">Generate</span>
              <Icon name="arrow" />
            </button>
          </div>
          <div className="sc-meta">
            <span>Enter to send · Shift + Enter for a new line</span>
            <span>{getButtonCreditText()}</span>
          </div>
        </div>
      </div>

      {/* First-Time Onboarding */}
      {shouldShowOnboarding && (
        <OnboardingQuestionnaire
          profile={profile}
          onSkipAction={handleSkipOnboarding}
          onWizardSubmitAction={handleWizardSubmit}
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



      {/* Pro Discount Modal - 50% off for 3min after 1st generation */}
      {showProDiscountModal && (
        <ProDiscountModal
          onCloseAction={() => setShowProDiscountModal(false)}
          onUpgradeAction={() => {
            setShowProDiscountModal(false)
            // Redirect to billing with Pro plan
            window.location.href = '/billing?plan=pro&discount=true'
          }}
        />
      )}

      {/* Credit Popup - Full pricing (fallback) */}
      {showCreditPopup && (
        <PricingPlans
          onSubscribeAction={handleSubscribe}
          isLoading={isUpgrading}
          variant="popup"
        />
      )}
    </div>
  )
}
