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

  // Debug guard - helps confirm context isn't resetting unexpectedly
  useEffect(() => {
    console.log('🧠 GeneratorContext initialized. Active tab:', state.activeTab)
  }, [])

  // SECURITY FIX: Only clear localStorage on explicit signout to prevent user data leakage
  // Don't clear automatically on every load - that destroys user session and causes loops  
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null

    const setupListener = async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
          localStorage.removeItem('generatorHistories')
          localStorage.removeItem('activeGeneratorTab')
          console.log('🔥 Cleared localStorage on user signout')
        }
      })
      subscription = data.subscription
    }

    setupListener()

    return () => {
      if (subscription) {
        subscription.unsubscribe()
        console.log('🧹 Unsubscribed auth listener')
      }
    }
  }, [])

  // Sync activeTab with URL pathname - prevent double render loop
  useEffect(() => {
    const lastSegment = pathname.split('/').pop() || ''
    const urlMode = ['text-to-image','image-to-image','text-to-video','image-to-video']
      .includes(lastSegment)
      ? (lastSegment as GeneratorMode)
      : 'text-to-image'

    setState(prev => (
      prev.activeTab === urlMode ? prev : { ...prev, activeTab: urlMode }
    ))
  }, [pathname])

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
    console.log('🔍 pushMessage called for tab:', tab, 'message:', message.role, message.id)
    setState(prev => {
      // Check if message already exists to prevent duplicates
      // Check by both id AND jobId + role combination to prevent job-based duplicates
      const exists = prev.histories[tab].some(m => 
        m.id === message.id || 
        (message.jobId && m.jobId === message.jobId && m.role === message.role)
      )
      if (exists) {
        console.log('🚫 Message already exists, skipping:', message.id, 'jobId:', message.jobId)
        return prev // Return unchanged state
      }
      
      const newState = {
        ...prev,
        histories: {
          ...prev.histories,
          [tab]: [...prev.histories[tab], message]
        }
      }
      console.log('✅ Message pushed to state, new count for', tab, ':', newState.histories[tab].length)
      return newState
    })
  }

  const updateMessage = (tab: GeneratorMode, id: string, patch: Partial<ChatMessage>) => {
    setState(prev => {
      // Check if message exists before updating
      const messageExists = prev.histories[tab].some(m => m.id === id)
      if (!messageExists) {
        console.log('🚫 Message not found for update, skipping:', id)
        return prev // Return unchanged state
      }
      
      return {
        ...prev,
        histories: {
          ...prev.histories,
          [tab]: prev.histories[tab].map(m => m.id === id ? { ...m, ...patch } : m)
        }
      }
    })
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
