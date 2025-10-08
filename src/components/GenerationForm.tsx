'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/validations'

interface GenerationFormProps {
  user: User
  profile: Profile
  mode: 'text-to-image' | 'image-to-image' | 'text-to-video' | 'image-to-video'
  title: string
  description: string
  placeholder: string
  creditCost: number
  estimatedTime: string
  icon: string
}

export default function GenerationForm({
  user,
  profile,
  mode,
  title,
  description,
  placeholder,
  creditCost,
  estimatedTime,
  icon
}: GenerationFormProps) {
  const [prompt, setPrompt] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [aspectRatio, setAspectRatio] = useState<'square' | 'landscape' | 'portrait'>('square')
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const requiresImage = mode === 'image-to-image' || mode === 'image-to-video'
  const isVideoMode = mode === 'text-to-video' || mode === 'image-to-video'
  const hasEnoughCredits = profile.credits >= creditCost

  // Simulate progress for better UX
  useEffect(() => {
    if (isGenerating) {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev
          return prev + Math.random() * 10
        })
      }, 1000)
      return () => clearInterval(interval)
    } else {
      setProgress(0)
    }
  }, [isGenerating])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setError(null)
    }
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt')
      return
    }

    if (requiresImage && !selectedFile) {
      setError('Please upload an image')
      return
    }

    setIsGenerating(true)
    setError(null)
    setResult(null)

    try {
      // Step 1: Upload image if required
      let imageId: string | null = null

      if (requiresImage && selectedFile) {
        const fileName = `${user.id}/${Date.now()}-${selectedFile.name}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('uploads')
          .upload(fileName, selectedFile)

        if (uploadError) throw new Error(uploadError.message)

        // Create image record
        const { data: imageData, error: imageError } = await supabase
          .from('images')
          .insert({
            user_id: user.id,
            file_path: uploadData.path,
            original_name: selectedFile.name,
            folder_id: null
          })
          .select()
          .single()

        if (imageError) throw new Error(imageError.message)
        imageId = imageData.id
      }

      // Step 2: Determine model based on mode and aspect ratio
      let model: string = mode
      if (aspectRatio === 'landscape') model = `${mode}-landscape`
      else if (aspectRatio === 'portrait') model = `${mode}-portrait`

      // Step 3: Create job
      const jobData: any = {
        user_id: user.id,
        model,
        prompt: prompt.trim(),
        status: 'pending',
        result_type: isVideoMode ? 'video' : 'image',
        has_images: requiresImage,
        image_ids: imageId ? [imageId] : []
      }

      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert(jobData)
        .select()
        .single()

      if (jobError) throw new Error(jobError.message)

      // Step 4: Call the appropriate edge function
      const functionName = mode.replace(/-/g, '-')
      const response = await fetch(`/api/supabase/functions/${functionName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Generation failed')
      }

      const { result_path } = await response.json()

      // Step 5: Get result URL
      const { data: resultData } = supabase.storage
        .from('results')
        .getPublicUrl(result_path)

      setResult(resultData.publicUrl)

    } catch (err: any) {
      console.error('Generation error:', err)
      setError(err.message || 'Generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header with Plan Indicator */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span>{icon}</span>
              {title}
            </h1>
            <p className="text-sm text-gray-600 mt-1">{description}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2">
              <span>⭐</span>
              <span>{profile.credits} credits left</span>
            </div>
            {(profile.credits < 10) && (
              <Link
                href="/billing"
                className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors"
              >
                Upgrade
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Image Upload Section (if required) */}
        {requiresImage && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Upload Image
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            {previewUrl ? (
              <div className="relative group">
                <Image
                  src={previewUrl}
                  alt="Preview"
                  width={600}
                  height={600}
                  className="mx-auto rounded-lg shadow-md"
                />
                <button
                  onClick={() => {
                    setSelectedFile(null)
                    setPreviewUrl(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="absolute top-3 right-3 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 transition-all shadow-lg opacity-0 group-hover:opacity-100"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-16 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all group"
              >
                <svg className="mx-auto h-12 w-12 text-gray-400 group-hover:text-purple-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="mt-3 text-sm font-medium text-gray-900">Click to upload an image</p>
                <p className="mt-1 text-xs text-gray-500">PNG, JPG, WebP up to 10MB</p>
              </button>
            )}
          </div>
        )}

        {/* Prompt Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={placeholder}
            rows={4}
            maxLength={isVideoMode ? 500 : 400}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
          />
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <span>Be specific for better results</span>
            <span>{prompt.length}/{isVideoMode ? 500 : 400}</span>
          </div>
        </div>

        {/* Aspect Ratio Selector */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <label className="block text-sm font-semibold text-gray-900 mb-4">
            Aspect Ratio
          </label>
          <div className="grid grid-cols-3 gap-4">
            {[
              { value: 'square', label: '1:1 Square', icon: '⬜' },
              { value: 'landscape', label: '16:9 Landscape', icon: '🖼️' },
              { value: 'portrait', label: '9:16 Portrait', icon: '📱' }
            ].map((ratio) => (
              <button
                key={ratio.value}
                onClick={() => setAspectRatio(ratio.value as any)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  aspectRatio === ratio.value
                    ? 'border-purple-500 bg-purple-50 shadow-md'
                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                }`}
              >
                <div className="text-2xl mb-2">{ratio.icon}</div>
                <div className="font-semibold text-sm">{ratio.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !hasEnoughCredits || !prompt.trim() || (requiresImage && !selectedFile)}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all shadow-lg ${
            isGenerating || !hasEnoughCredits || !prompt.trim() || (requiresImage && !selectedFile)
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transform hover:scale-[1.02]'
          }`}
        >
          {isGenerating ? (
            <span className="flex items-center justify-center gap-3">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Generating...</span>
            </span>
          ) : !hasEnoughCredits ? (
            `Not Enough Credits (Need ${creditCost})`
          ) : (
            `Generate ${isVideoMode ? 'Video' : 'Image'} • ${creditCost} Credit${creditCost > 1 ? 's' : ''}`
          )}
        </button>

        {!hasEnoughCredits && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
            <p className="text-orange-800 font-medium">
              You need {creditCost - profile.credits} more credit{creditCost - profile.credits > 1 ? 's' : ''} to generate.
            </p>
            <Link
              href="/billing"
              className="inline-block mt-3 px-6 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors"
            >
              Get More Credits
            </Link>
          </div>
        )}

        {/* Loading State */}
        {isGenerating && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="inline-block animate-pulse text-6xl mb-4">
              {isVideoMode ? '🎬' : '✨'}
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {isVideoMode ? 'Creating your video...' : 'Generating your image...'}
            </h3>
            <p className="text-gray-600 mb-4">Estimated time: {estimatedTime}</p>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Pro users enjoy faster generation 🚀
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-800 font-medium">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && !isGenerating && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Your Result</h3>
            {isVideoMode ? (
              <video
                src={result}
                controls
                autoPlay
                loop
                className="w-full rounded-lg shadow-md"
              />
            ) : (
              <Image
                src={result}
                alt="Generated result"
                width={800}
                height={800}
                className="w-full rounded-lg shadow-md"
              />
            )}
            <div className="mt-6 flex gap-3">
              <a
                href={result}
                download
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-semibold hover:from-green-600 hover:to-emerald-600 transition-all text-center"
              >
                ⬇️ Download
              </a>
              <button
                onClick={() => {
                  setResult(null)
                  setError(null)
                }}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-600 transition-all"
              >
                🔁 Generate New
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
