'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { usePathname } from 'next/navigation'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  status?: 'pending' | 'complete' | 'error'
  mediaUrl?: string | null
  mediaType?: 'image' | 'video'
  jobId?: string // Store the job ID so we can resume polling after refresh
}

type GeneratorMode = 'text-to-image' | 'image-to-image' | 'text-to-video' | 'image-to-video'

interface GeneratorState {
  activeTab: GeneratorMode
  prompt: string
  aspectRatio: 'landscape' | 'portrait'
  selectedFile: File | null
  previewUrl: string | null
  isGenerating: boolean
  result: string | null
  error: string | null
  histories: Record<GeneratorMode, ChatMessage[]>
  resolutions: Record<GeneratorMode, '1K' | '2K' | '4K'>
}

interface GeneratorContextType extends GeneratorState {
  setActiveTab: (tab: GeneratorMode) => void
  setPrompt: (prompt: string) => void
  setAspectRatio: (ratio: 'landscape' | 'portrait') => void
  setSelectedFile: (file: File | null) => void
  setPreviewUrl: (url: string | null) => void
  setIsGenerating: (generating: boolean) => void
  setResult: (result: string | null) => void
  setError: (error: string | null) => void
  resetState: () => void
  pushMessage: (tab: GeneratorMode, message: ChatMessage) => void
  updateMessage: (tab: GeneratorMode, id: string, patch: Partial<ChatMessage>) => void
  setResolution: (tab: GeneratorMode, res: '1K' | '2K' | '4K') => void
}

const GeneratorContext = createContext<GeneratorContextType | undefined>(undefined)

const initialState: GeneratorState = {
  activeTab: 'text-to-image',
  prompt: '',
  aspectRatio: 'landscape',
  selectedFile: null,
  previewUrl: null,
  isGenerating: false,
  result: null,
  error: null,
  histories: {
    'text-to-image': [],
    'image-to-image': [],
    'text-to-video': [],
    'image-to-video': [],
  },
  resolutions: {
    'text-to-image': '1K',
    'image-to-image': '1K',
    'text-to-video': '1K',
    'image-to-video': '1K',
  }
}

export function GeneratorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GeneratorState>(initialState)
  const pathname = usePathname()

  // CRITICAL SECURITY FIX: Clear localStorage to prevent user data leakage between accounts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('generatorHistories')
      localStorage.removeItem('activeGeneratorTab')
      console.log('🔥 SECURITY FIX: Cleared localStorage to prevent user data leakage')
    }
  }, [])

  // Sync activeTab with URL pathname
  useEffect(() => {
    const pathSegments = pathname.split('/')
    const lastSegment = pathSegments[pathSegments.length - 1]
    
    let urlMode: GeneratorMode | null = null
    
    // Map URL segments to generator modes
    switch (lastSegment) {
      case 'text-to-image':
        urlMode = 'text-to-image'
        break
      case 'image-to-image':
        urlMode = 'image-to-image'
        break
      case 'text-to-video':
        urlMode = 'text-to-video'
        break
      case 'image-to-video':
        urlMode = 'image-to-video'
        break
      default:
        urlMode = 'text-to-image' // Default fallback
    }
    
    if (urlMode && state.activeTab !== urlMode) {
      setState(prev => ({ ...prev, activeTab: urlMode! }))
    }
  }, [pathname, state.activeTab])

  // Set active tab (NO localStorage to prevent user data leakage)
  const setActiveTab = (tab: GeneratorMode) => {
    setState(prev => ({ ...prev, activeTab: tab }))
    // REMOVED: localStorage.setItem() to prevent user data leakage between accounts
  }

  const setPrompt = (prompt: string) => setState(prev => ({ ...prev, prompt }))
  const setAspectRatio = (aspectRatio: 'landscape' | 'portrait') => 
    setState(prev => ({ ...prev, aspectRatio }))
  const setSelectedFile = (selectedFile: File | null) => 
    setState(prev => ({ ...prev, selectedFile }))
  const setPreviewUrl = (previewUrl: string | null) => 
    setState(prev => ({ ...prev, previewUrl }))
  const setIsGenerating = (isGenerating: boolean) => 
    setState(prev => ({ ...prev, isGenerating }))
  const setResult = (result: string | null) => 
    setState(prev => ({ ...prev, result }))
  const setError = (error: string | null) => 
    setState(prev => ({ ...prev, error }))

  const pushMessage = (tab: GeneratorMode, message: ChatMessage) => {
    setState(prev => ({
      ...prev,
      histories: {
        ...prev.histories,
        [tab]: [...prev.histories[tab], message]
      }
    }))
  }

  const updateMessage = (tab: GeneratorMode, id: string, patch: Partial<ChatMessage>) => {
    setState(prev => ({
      ...prev,
      histories: {
        ...prev.histories,
        [tab]: prev.histories[tab].map(m => m.id === id ? { ...m, ...patch } : m)
      }
    }))
  }

  const setResolution = (tab: GeneratorMode, res: '1K' | '2K' | '4K') => {
    setState(prev => ({
      ...prev,
      resolutions: { ...prev.resolutions, [tab]: res }
    }))
  }

  const resetState = () => {
    setState(prev => ({
      ...initialState,
      activeTab: prev.activeTab, // Keep active tab
    }))
  }

  return (
    <GeneratorContext.Provider
      value={{
        ...state,
        setActiveTab,
        setPrompt,
        setAspectRatio,
        setSelectedFile,
        setPreviewUrl,
        setIsGenerating,
        setResult,
        setError,
        resetState,
        pushMessage,
        updateMessage,
        setResolution,
      }}
    >
      {children}
    </GeneratorContext.Provider>
  )
}

export function useGenerator() {
  const context = useContext(GeneratorContext)
  if (context === undefined) {
    throw new Error('useGenerator must be used within a GeneratorProvider')
  }
  return context
}
