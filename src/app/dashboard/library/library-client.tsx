'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/validations'
import type { GeneratedAd } from '@/types'
import DashboardLayout from '@/components/DashboardLayout'

interface LibraryClientProps {
  user: User
  profile: Profile
}

export default function LibraryClient({ user, profile }: LibraryClientProps) {
  const [ads, setAds] = useState<GeneratedAd[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isChangingView, setIsChangingView] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest')

  const handleViewModeChange = (newMode: 'grid' | 'list') => {
    if (newMode !== viewMode) {
      setIsChangingView(true)
      setTimeout(() => {
        setViewMode(newMode)
        setIsChangingView(false)
      }, 300) // Brief loading animation
    }
  }

  useEffect(() => {
    const fetchAllImages = async () => {
      try {
        const response = await fetch('/api/generated-ads')
        if (response.ok) {
          const data = await response.json()
          console.log('API Response:', data)
          console.log('Type of data:', typeof data)
          console.log('Is data array:', Array.isArray(data))
          console.log('data.generatedAds:', data.generatedAds)
          console.log('Is data.generatedAds array:', Array.isArray(data.generatedAds))
          
          // The API returns { generatedAds: [...] }
          const adsArray = Array.isArray(data.generatedAds) ? data.generatedAds : 
                          Array.isArray(data.ads) ? data.ads : 
                          Array.isArray(data) ? data : []
          setAds(adsArray)
        }
      } catch (error) {
        console.error('Error fetching images:', error)
        setAds([]) // Ensure we always have an array
      } finally {
        setIsLoading(false)
      }
    }

    fetchAllImages()
  }, [])

  const downloadImage = async (ad: GeneratedAd) => {
    try {
      const response = await fetch(ad.url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `${ad.name || 'image'}.png`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading image:', error)
    }
  }

  const filteredAds = Array.isArray(ads) ? ads.filter(ad =>
    (ad.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ad.folder_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  ) : []

  const sortedAds = [...filteredAds].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'oldest':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      case 'name':
        const nameA = (a.name || '').toLowerCase()
        const nameB = (b.name || '').toLowerCase()
        return nameA.localeCompare(nameB)
      default:
        return 0
    }
  })

  return (
    <DashboardLayout user={user} profile={profile}>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Library</h1>
          <p className="text-gray-600">
            Browse and manage all your folders and generated ads in one place.
          </p>
        </div>

        {/* Search and View Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          {/* Search Bar */}
          <div className="flex-1">
            <div className="relative max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search images and folders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-3 w-full border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
              />
            </div>
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'name')}
            className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Name A-Z</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => handleViewModeChange('grid')}
              disabled={isChangingView}
              className={`p-2 rounded-md transition-colors duration-200 ${
                viewMode === 'grid'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              } ${isChangingView ? 'opacity-50' : ''}`}
              title="Grid view"
            >
              {isChangingView && viewMode !== 'grid' ? (
                <div className="w-5 h-5 border-2 border-gray-400/30 border-t-gray-600 rounded-full animate-spin"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              )}
            </button>
            <button
              onClick={() => handleViewModeChange('list')}
              disabled={isChangingView}
              className={`p-2 rounded-md transition-colors duration-200 ${
                viewMode === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              } ${isChangingView ? 'opacity-50' : ''}`}
              title="List view"
            >
              {isChangingView && viewMode !== 'list' ? (
                <div className="w-5 h-5 border-2 border-gray-400/30 border-t-gray-600 rounded-full animate-spin"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Images Display */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden relative">
          {isChangingView && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
                <span className="text-sm text-gray-600">Changing view...</span>
              </div>
            </div>
          )}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">All Images</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {sortedAds.length} image{sortedAds.length !== 1 ? 's' : ''} found
                </p>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-600">Loading images...</p>
            </div>
          ) : sortedAds.length > 0 ? (
            <div className={`p-6 ${
              viewMode === 'grid' 
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                : 'space-y-2'
            }`}>
              {sortedAds.map((ad) => (
                viewMode === 'grid' ? (
                  <div
                    key={ad.id}
                    className="group relative bg-white rounded-xl border border-gray-200 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/50 transition-all duration-200 overflow-hidden"
                  >
                    <div className="aspect-square relative">
                      <Image
                        src={ad.url}
                        alt={ad.name || 'Generated Ad'}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200" />
                      <button
                        onClick={() => downloadImage(ad)}
                        className="absolute top-2 right-2 p-2 bg-white/90 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-white"
                        title="Download image"
                      >
                        <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                    </div>
                    
                    <div className="p-3">
                      <h3 className="font-medium text-gray-900 mb-1 truncate">
                        {ad.name || 'Untitled'}
                      </h3>
                      
                      <p className="text-xs text-gray-500 mb-1 truncate">
                        Folder: {ad.folder_name || 'Unknown'}
                      </p>
                      
                      <p className="text-xs text-gray-400">
                        {new Date(ad.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div
                    key={ad.id}
                    className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors duration-200 border border-transparent hover:border-gray-200"
                  >
                    <div className="w-12 h-12 relative rounded-lg overflow-hidden mr-3 flex-shrink-0">
                      <Image
                        src={ad.url}
                        alt={ad.name || 'Generated Ad'}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{ad.name || 'Untitled'}</h3>
                      <p className="text-sm text-gray-500 truncate">
                        Folder: {ad.folder_name || 'Unknown'} • {new Date(ad.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => downloadImage(ad)}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                      title="Download image"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                  </div>
                )
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No images found</h3>
              <p className="text-gray-600 mb-6">
                {searchTerm ? 'Try adjusting your search terms.' : 'Generate your first ad to get started.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}