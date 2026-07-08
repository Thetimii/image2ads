import { useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { toast } from 'sonner'
import type { Profile } from '@/lib/validations'
import { track } from '@/lib/analytics'

interface FirstTimeOnboardingProps {
  profile: Profile
  onSkipAction: () => void
  // Fired the moment a photo (real upload or sample) or a typed description
  // is ready - the parent (ChatGenerator) takes it from here and runs the
  // exact same upload -> job -> generate pipeline a normal chat message uses.
  // file is null for the text-only fallback path.
  onWizardSubmitAction: (file: File | null, prompt: string) => void
}

interface SampleProduct {
  src: string
  label: string
  prompt: string
}

const SAMPLES: SampleProduct[] = [
  {
    src: '/before1.jpg',
    label: 'Mug',
    prompt: 'A professional studio shot of this mug on a marble surface with dramatic side lighting and a softly blurred background, 4k commercial product photography.',
  },
  {
    src: '/before2.jpg',
    label: 'Tote bag',
    prompt: 'A lifestyle product photo of this tote bag hanging against a warm, softly lit neutral wall, styled like a boutique ad, 4k commercial product photography.',
  },
  {
    src: '/before3.jpg',
    label: 'Hoodie',
    prompt: 'A professional studio flat-lay shot of this hoodie on a clean neutral background with soft even lighting, 4k commercial product photography.',
  },
]

const DEFAULT_UPLOAD_PROMPT = 'A professional studio shot of the uploaded product on a marble surface, dramatic lighting, 4k resolution.'
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024 // 20MB

export default function OnboardingQuestionnaire({ profile, onSkipAction, onWizardSubmitAction }: FirstTimeOnboardingProps) {
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)
  const [hasShownConfetti, setHasShownConfetti] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const [loadingSample, setLoadingSample] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const needsOnboarding = !profile.tutorial_completed

    if (needsOnboarding && !hasShownConfetti) {
      fireConfetti()
      setHasShownConfetti(true)

      setTimeout(() => {
        setShowWelcomeModal(true)
      }, 1000)
    }
  }, [profile.tutorial_completed, hasShownConfetti])

  const fireConfetti = () => {
    const duration = 2500
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 }

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min
    }

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now()

      if (timeLeft <= 0) {
        clearInterval(interval)
        return
      }

      const particleCount = 50 * (timeLeft / duration)

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      })
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      })
    }, 250)
  }

  const handleUploadClick = () => {
    track('upload_clicked', { source: 'onboarding_wizard' })
    fileInputRef.current?.click()
  }

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow selecting the same file again later

    if (!file) return

    if (!file.type.startsWith('image/')) {
      track('upload_failed', { source: 'onboarding_wizard', reason: 'not_an_image' })
      toast.error('Please choose an image file.')
      return
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      track('upload_failed', { source: 'onboarding_wizard', reason: 'file_too_large' })
      toast.error('That photo is too large - try one under 20MB.')
      return
    }

    setShowWelcomeModal(false)
    onWizardSubmitAction(file, DEFAULT_UPLOAD_PROMPT)
  }

  const handleSampleClick = async (sample: SampleProduct) => {
    track('sample_image_used', { source: 'onboarding_wizard', sample: sample.label })
    setLoadingSample(sample.src)
    try {
      const res = await fetch(sample.src)
      const blob = await res.blob()
      const file = new File([blob], `${sample.label.toLowerCase().replace(/\s+/g, '-')}.jpg`, {
        type: blob.type || 'image/jpeg',
      })
      setShowWelcomeModal(false)
      onWizardSubmitAction(file, sample.prompt)
    } catch {
      track('upload_failed', { source: 'onboarding_wizard', reason: 'sample_fetch_failed' })
      toast.error('Could not load that sample - try uploading your own photo instead.')
    } finally {
      setLoadingSample(null)
    }
  }

  const handleSkip = () => {
    setShowWelcomeModal(false)
    onSkipAction()
  }

  const handleCustomPromptSubmit = () => {
    if (!customPrompt.trim()) return
    setShowWelcomeModal(false)
    onWizardSubmitAction(null, customPrompt.trim())
  }

  if (!showWelcomeModal) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-[9998] animate-in fade-in duration-300" />

      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto p-4 sm:p-6"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
        }}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">

          {/* Header */}
          <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-6 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-black/10 backdrop-blur-sm"></div>
            <div className="relative z-10 text-center">
              <div className="text-4xl mb-2 animate-bounce inline-block">👋</div>
              <h2 className="text-xl sm:text-2xl font-bold leading-tight">
                Let&apos;s make your first ad
              </h2>
              <p className="text-white/90 text-sm mt-1">
                Add a product photo - we&apos;ll handle the rest
              </p>
            </div>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6 bg-gray-50">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelected}
            />

            {/* Primary tap target */}
            <button
              onClick={handleUploadClick}
              className="w-full bg-white border-2 border-dashed border-purple-300 hover:border-purple-500 hover:bg-purple-50/50 rounded-xl p-6 flex flex-col items-center justify-center gap-2 transition-colors"
            >
              <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center text-3xl">
                📸
              </div>
              <span className="font-bold text-gray-900 text-base">Upload your product photo</span>
              <span className="text-gray-500 text-xs">Tap to take a photo or choose from your gallery</span>
            </button>

            {/* Samples */}
            <div className="mt-5">
              <p className="text-center text-xs font-medium text-gray-500 mb-2">Or try with a sample</p>
              <div className="grid grid-cols-3 gap-2">
                {SAMPLES.map((sample) => (
                  <button
                    key={sample.src}
                    onClick={() => handleSampleClick(sample)}
                    disabled={loadingSample !== null}
                    className="relative group rounded-lg overflow-hidden border border-gray-200 hover:border-purple-400 transition-colors disabled:opacity-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={sample.src}
                      alt={sample.label}
                      className="w-full h-20 sm:h-24 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      {loadingSample === sample.src && (
                        <span className="text-white text-xs font-semibold bg-black/60 px-2 py-1 rounded">Loading…</span>
                      )}
                    </div>
                    <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] py-0.5 text-center">
                      {sample.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced / text-only fallback, collapsed by default */}
            <div className="mt-5">
              <button
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
              >
                {showAdvanced ? 'Hide' : "Don't have a photo? Describe it instead"}
              </button>
              {showAdvanced && (
                <div className="mt-2 flex flex-col gap-2">
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="e.g. A cozy candle on a wooden table with warm morning light"
                    rows={2}
                    className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                  <button
                    onClick={handleCustomPromptSubmit}
                    disabled={!customPrompt.trim()}
                    className="self-end text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-4 py-1.5"
                  >
                    Generate
                  </button>
                </div>
              )}
            </div>

            <div className="mt-5 text-center">
              <button
                onClick={handleSkip}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
