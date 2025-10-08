'use client'

import { useEffect, useRef, useState } from 'react'
import { useGenerator } from '@/contexts/GeneratorContext'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/validations'
import ChatHistory from './ChatHistory'

interface SimplifiedChatGeneratorProps {
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

const TAB_META: Record<string, { title: string; subtitle: string; locked?: boolean; model: string; resultType: 'image' | 'video' }> = {
  'text-to-image': { title: '🖼️ Text to Image', subtitle: 'Generate product-ready visuals from ideas', model: 'gemini', resultType: 'image' },
  'image-to-image': { title: '🌅 Image to Image', subtitle: 'Transform or restyle an input image', model: 'gemini', resultType: 'image' },
  'text-to-video': { title: '🎬 Text to Video', subtitle: 'Bring concepts to motion with AI video', locked: true, model: 'sora-2', resultType: 'video' },
  'image-to-video': { title: '🎥 Image to Video', subtitle: 'Animate a still into dynamic video', locked: true, model: 'sora-2', resultType: 'video' },
}

const EXAMPLES: Record<string, Array<{ short: string; full: string }>> = {
  'text-to-image': [
    {
      short: '☕ Coffee Cup on Wooden Table',
      full: 'Ultra-detailed cinematic product photo of a double-walled glass coffee mug on a wet rustic wooden counter at sunrise, shallow depth of field, soft volumetric light through foggy window, micro droplets'
    },
    {
      short: '💄 Skincare Bottle',
      full: 'Premium skincare bottle on rippled water surface, translucent gel splashes frozen mid-air, morning spa ambience, diffused natural daylight, soft muted pastel palette'
    }
  ],
  'image-to-image': [
    {
      short: '🌃 Cyberpunk Neon Scene',
      full: 'Restyle this into a moody cyberpunk neon scene, rain-soaked surfaces, teal and magenta glow, cinematic contrast, atmospheric haze'
    }
  ],
  'text-to-video': [
    {
      short: '🛴 Forest Trail Scene',
      full: '8 second cinematic dolly shot of a futuristic eco-friendly electric scooter gliding through a misty forest trail at dawn, soft god rays, particles in air'
    }
  ],
  'image-to-video': [
    {
      short: '✨ Parallax Depth Reveal',
      full: 'Animate into a subtle 6s parallax reveal: foreground lifts gently, depth layers move at different speeds, soft ambient particles'
    }
  ]
}

export default function SimplifiedChatGenerator({ user, profile, onLockedFeature }: SimplifiedChatGeneratorProps) {
  const gen = useGenerator()
  const supabase = createClient()
  const [input, setInput] = useState('')
  const [localFile, setLocalFile] = useState<File | null>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const meta = TAB_META[gen.activeTab]
  const requiresImage = gen.activeTab === 'image-to-image' || gen.activeTab === 'image-to-video'
  const isLocked = !!meta.locked && !profile?.stripe_customer_id

  const handleExample = (fullPrompt: string) => {
    setInput(fullPrompt)
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = Math.min(120, Math.max(40, textareaRef.current.scrollHeight)) + 'px'
      }
    }, 0)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
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

  const sendPrompt = async () => {
    if (!input.trim() || isSubmitting) return
    if (isLocked) {
      onLockedFeature?.()
      return
    }
    if (requiresImage && !localFile) {
      alert('Please upload a reference image first')
      return
    }

    setIsSubmitting(true)

    try {
      // Create job in database
      const jobPayload = {
        user_id: user.id,
        model: meta.model,
        prompt: input.trim(),
        status: 'pending',
        result_type: meta.resultType,
        has_images: !!localFile,
      }

      const { data: job, error: jobErr } = await supabase
        .from('jobs')
        .insert(jobPayload)
        .select()
        .single()

      if (jobErr) throw jobErr

      // Call Edge Function
      const endpoint = ENDPOINT_MAP[gen.activeTab]
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('No valid session token found')
      }

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ jobId: job.id })
      })

      if (!resp.ok) {
        throw new Error('Generation failed')
      }

      // Clear form
      setInput('')
      setLocalFile(null)
      setLocalPreview(null)

    } catch (error) {
      console.error('Generation error:', error)
      alert('Generation failed. Please try again.')
    } finally {
      setIsSubmitting(false)
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

      {/* Chat History */}
      <div className="flex-1 overflow-hidden">
        <ChatHistory jobType={gen.activeTab} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white px-3 sm:px-4 py-2 sm:py-3 flex flex-col gap-2 shadow-inner">
        {/* Examples */}
        <div className="flex gap-2 overflow-x-auto text-xs text-gray-600 pb-1 scrollbar-hide -mx-1 px-1">
          {EXAMPLES[gen.activeTab]?.map(ex => (
            <button
              key={ex.short}
              onClick={() => handleExample(ex.full)}
              className="px-2 py-1 md:px-3 md:py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition text-gray-600 whitespace-nowrap border border-gray-200 hover:border-gray-300 text-[10px] md:text-xs flex-shrink-0"
              title={ex.full}
            >
              {ex.short}
            </button>
          ))}
        </div>

        {/* Input Row */}
        <div className="flex items-center gap-2">
          {requiresImage && (
            <>
              <button
                onClick={handleUploadClick}
                className="text-lg sm:text-xl hover:opacity-80 active:scale-95 cursor-pointer transition"
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
                    className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs"
                  >×</button>
                </div>
              )}
            </>
          )}
          
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            placeholder="Describe your idea..."
            rows={1}
            className="flex-1 border border-gray-300 rounded-2xl px-3 sm:px-4 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none overflow-hidden min-h-[36px] max-h-[100px]"
            style={{ height: '36px' }}
          />
          
          <button
            onClick={sendPrompt}
            disabled={isSubmitting || (requiresImage && !localFile) || !input.trim()}
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold hover:scale-[1.03] active:scale-[0.97] transition disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-1 sm:gap-2 flex-shrink-0"
          >
            <span>⚡ Generate</span>
            <span className="bg-white/20 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs">
              {meta.resultType === 'video' ? '8' : '1'} cr
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}