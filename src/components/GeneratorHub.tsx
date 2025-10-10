'use client'

import { useGenerator } from '@/contexts/GeneratorContext'
import { useState, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/validations'

interface GeneratorHubProps {
  user: User
  profile: Profile
}

const tabs = [
  { id: 'text-to-image', label: 'Text to Image', emoji: '📝' },
  { id: 'image-to-image', label: 'Image to Image', emoji: '🖼️' },
  { id: 'text-to-video', label: 'Text to Video', emoji: '🎥' },
  { id: 'image-to-video', label: 'Image to Video', emoji: '📸' },
  { id: 'text-to-music', label: 'Text to Music', emoji: '🎵' },
] as const

export default function GeneratorHub({ user, profile }: GeneratorHubProps) {
  const generator = useGenerator()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const requiresImage = generator.activeTab === 'image-to-image' || generator.activeTab === 'image-to-video'
  const isVideoMode = generator.activeTab === 'text-to-video' || generator.activeTab === 'image-to-video'
  const isMusicMode = generator.activeTab === 'text-to-music'

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      generator.setSelectedFile(file)
      generator.setPreviewUrl(URL.createObjectURL(file))
      generator.setError(null)
    }
  }

  const handleGenerate = async () => {
    if (!generator.prompt.trim()) {
      generator.setError('Please enter a prompt')
      return
    }

    if (requiresImage && !generator.selectedFile) {
      generator.setError('Please upload an image')
      return
    }

    generator.setIsGenerating(true)
    generator.setError(null)
    generator.setResult(null)

    try {
      // Step 1: Upload image if required
      let imageId: string | null = null

      if (requiresImage && generator.selectedFile) {
        const fileName = `${user.id}/${Date.now()}-${generator.selectedFile.name}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('uploads')
          .upload(fileName, generator.selectedFile)

        if (uploadError) throw new Error(uploadError.message)

        const { data: imageData, error: imageError } = await supabase
          .from('images')
          .insert({
            user_id: user.id,
            file_path: uploadData.path,
            original_name: generator.selectedFile.name,
            folder_id: null
          })
          .select()
          .single()

        if (imageError) throw new Error(imageError.message)
        imageId = imageData.id
      }

      // Step 2: Determine model
      let model: string = generator.activeTab
      if (generator.aspectRatio === 'landscape') model = `${generator.activeTab}-landscape`
      else if (generator.aspectRatio === 'portrait') model = `${generator.activeTab}-portrait`

      // Step 3: Create job
      const jobData: any = {
        user_id: user.id,
        model,
        prompt: generator.prompt.trim(),
        status: 'pending',
        result_type: isMusicMode ? 'music' : isVideoMode ? 'video' : 'image',
        has_images: requiresImage,
        image_ids: imageId ? [imageId] : []
      }

      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert(jobData)
        .select()
        .single()

      if (jobError) throw new Error(jobError.message)

      // Step 4: Call edge function
      const functionName = generator.activeTab.replace(/-/g, '-')
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
      const { data: resultData } = supabase.storage.from('results').getPublicUrl(result_path)
      generator.setResult(resultData.publicUrl)

    } catch (err: any) {
      console.error('Generation error:', err)
      generator.setError(err.message || 'Generation failed')
    } finally {
      generator.setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-5xl mx-auto px-6 py-8 pb-20">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">
              {tabs.find(t => t.id === generator.activeTab)?.emoji}{' '}
              {tabs.find(t => t.id === generator.activeTab)?.label}
            </h1>
            <p className="text-gray-500 mt-1">Create stunning images and videos with AI</p>
          </div>
          <div className="rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 text-sm font-medium hover:brightness-110 transition-all cursor-pointer">
            {profile.credits} Credits
          </div>
        </div>

        {/* Image Upload (Conditional) */}
        {requiresImage && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6 hover:shadow-md transition-all duration-200">
            <h3 className="text-gray-700 font-medium mb-4">Upload Reference Image</h3>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            {generator.previewUrl ? (
              <div className="relative rounded-lg overflow-hidden shadow-sm">
                <Image
                  src={generator.previewUrl}
                  alt="Preview"
                  width={600}
                  height={600}
                  className="w-full h-auto"
                />
                <button
                  onClick={() => {
                    generator.setSelectedFile(null)
                    generator.setPreviewUrl(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="absolute top-3 right-3 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 shadow-lg transition-all"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-16 border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-all group"
              >
                <svg className="mx-auto h-12 w-12 text-gray-400 group-hover:text-purple-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="mt-3 text-sm text-gray-600 font-medium">Click to upload an image</p>
                <p className="mt-1 text-xs text-gray-400">PNG, JPG up to 10MB</p>
              </button>
            )}
          </div>
        )}

        {/* Prompt Input */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <label className="block text-gray-700 font-medium mb-3">Prompt</label>
          <textarea
            value={generator.prompt}
            onChange={(e) => generator.setPrompt(e.target.value)}
            placeholder={`Describe your ${isMusicMode ? 'music' : isVideoMode ? 'video' : 'image'}...`}
            rows={4}
            className="w-full resize-none rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent p-4 text-gray-700 text-sm placeholder:text-gray-400"
          />
        </div>

        {/* Aspect Ratio Selector - Hide for music */}
        {!isMusicMode && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <label className="block text-gray-700 font-medium mb-4">
              {isVideoMode ? 'Aspect Ratio' : 'Image Size'}
            </label>
            <div className="grid grid-cols-2 gap-4">
              {(['landscape', 'portrait'] as const).map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => generator.setAspectRatio(ratio)}
                  className={`p-4 rounded-lg border-2 transition-all text-center ${
                    generator.aspectRatio === ratio
                      ? 'border-purple-500 bg-purple-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-gray-800 capitalize">{ratio}</div>
                  <div className="text-sm text-gray-500 mt-1">
                    {ratio === 'landscape' && '16:9'}
                    {ratio === 'portrait' && '9:16'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Generate Button */}
        <div className="text-center">
          <button
            onClick={handleGenerate}
            disabled={generator.isGenerating || profile.credits < 1}
            className="px-12 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {generator.isGenerating ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating...
              </span>
            ) : (
              `Generate (1 Credit)`
            )}
          </button>
          {generator.isGenerating && (
            <p className="mt-3 text-sm text-gray-500 italic">
              This may take {isVideoMode ? '2-5 minutes' : '30-60 seconds'}
            </p>
          )}
        </div>

        {/* Error */}
        {generator.error && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-800 text-sm">{generator.error}</p>
          </div>
        )}

        {/* Result */}
        {generator.result && (
          <div className="mt-8 bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Result</h3>
            <div className="flex flex-col items-center">
              {isMusicMode ? (
                <div className="w-full max-w-2xl bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-8 shadow-lg">
                  <div className="flex items-center justify-center mb-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center shadow-xl">
                      <span className="text-3xl">🎵</span>
                    </div>
                  </div>
                  <audio
                    src={generator.result}
                    controls
                    className="w-full mb-4"
                    style={{ borderRadius: '12px' }}
                  />
                  <p className="text-center text-gray-600 text-sm mb-4">
                    Your music has been generated successfully!
                  </p>
                </div>
              ) : isVideoMode ? (
                <video
                  src={generator.result}
                  controls
                  className="rounded-lg shadow-md max-w-full"
                />
              ) : (
                <Image
                  src={generator.result}
                  alt="Generated result"
                  width={800}
                  height={800}
                  className="rounded-lg shadow-md max-w-full h-auto"
                />
              )}
              <a
                href={generator.result}
                download
                className="mt-6 inline-block px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-semibold hover:brightness-110 shadow-md transition-all"
              >
                Download
              </a>
            </div>
          </div>
        )}

        {/* Loading Shimmer */}
        {generator.isGenerating && !generator.result && (
          <div className="mt-8 bg-white border border-gray-200 rounded-xl p-6">
            <div className="bg-gray-100 animate-pulse rounded-lg h-[400px] flex items-center justify-center">
              <div className="text-center">
                <svg className="animate-spin h-12 w-12 mx-auto text-purple-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="mt-4 text-gray-600 font-medium">Creating your {isMusicMode ? 'music' : isVideoMode ? 'video' : 'image'}...</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
