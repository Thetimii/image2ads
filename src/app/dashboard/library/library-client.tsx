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
  const [mediaFilter, setMediaFilter] = useState<'all' | 'image' | 'video' | 'music'>('all')
  const [selectedVideo, setSelectedVideo] = useState<GeneratedAd | null>(null)
  const [selectedImage, setSelectedImage] = useState<GeneratedAd | null>(null)
  const [selectedMusic, setSelectedMusic] = useState<GeneratedAd | null>(null)

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
          console.log('📊 Library API Response:', data)
          
          // The API returns { generatedAds: [...] }
          const adsArray = Array.isArray(data.generatedAds) ? data.generatedAds : 
                          Array.isArray(data.ads) ? data.ads : 
                          Array.isArray(data) ? data : []
          
          console.log('📊 Total items:', adsArray.length)
          console.log('📊 Media types breakdown:')
          adsArray.forEach((ad: GeneratedAd, index: number) => {
            console.log(`  ${index + 1}. ${ad.name} - Type: ${ad.mediaType || 'image'} - URL: ${ad.url}`)
          })
          
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

  // Keyboard support for closing modals
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (selectedVideo) {
          setSelectedVideo(null)
        } else if (selectedImage) {
          setSelectedImage(null)
        } else if (selectedMusic) {
          setSelectedMusic(null)
        }
      }
    }

    if (selectedVideo || selectedImage || selectedMusic) {
      document.addEventListener('keydown', handleKeyDown)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [selectedVideo, selectedImage, selectedMusic])

  const downloadMedia = async (ad: GeneratedAd) => {
    try {
      if (ad.mediaType === 'music') {
        // For music, download as ZIP with cover if available
        const audioResponse = await fetch(ad.url)
        const audioBlob = await audioResponse.blob()
        
        const JSZip = (await import('jszip')).default
        const zip = new JSZip()
        
        // Add music file
        const timestamp = new Date(ad.created_at).getTime()
        zip.file(`music_${timestamp}.mp3`, audioBlob)
        
        // Add cover if available
        if (ad.coverUrl) {
          try {
            const coverResponse = await fetch(ad.coverUrl)
            const coverBlob = await coverResponse.blob()
            zip.file(`cover_${timestamp}.jpg`, coverBlob)
          } catch (err) {
            console.warn('Could not download cover:', err)
          }
        }
        
        // Generate ZIP and download
        const zipBlob = await zip.generateAsync({ type: 'blob' })
        const url = window.URL.createObjectURL(zipBlob)
        const a = document.createElement('a')
        a.style.display = 'none'
        a.href = url
        a.download = `${ad.name || 'music'}_${timestamp}.zip`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        // Original logic for images and videos
        const response = await fetch(ad.url)
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.style.display = 'none'
        a.href = url
        // Set proper file extension based on media type
        const extension = ad.mediaType === 'video' ? '.mp4' : '.png'
        a.download = `${ad.name || (ad.mediaType === 'video' ? 'video' : 'image')}${extension}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Error downloading media:', error)
    }
  }

  const filteredAds = Array.isArray(ads) ? ads.filter(ad => {
    // Search filter
    const matchesSearch = (ad.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (ad.folder_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    
    // Media type filter
    const matchesMediaType = mediaFilter === 'all' || 
                            (mediaFilter === 'image' && (!ad.mediaType || ad.mediaType === 'image')) ||
                            (mediaFilter === 'video' && ad.mediaType === 'video') ||
                            (mediaFilter === 'music' && ad.mediaType === 'music')
    
    return matchesSearch && matchesMediaType
  }) : []

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

  // Calculate media type counts for filter labels
  const imageCount = ads.filter(ad => !ad.mediaType || ad.mediaType === 'image').length
  const videoCount = ads.filter(ad => ad.mediaType === 'video').length
  const musicCount = ads.filter(ad => ad.mediaType === 'music').length
  
  console.log('📊 Filter counts - Images:', imageCount, 'Videos:', videoCount, 'Music:', musicCount)
  console.log('📊 Current filter:', mediaFilter, '- Showing', sortedAds.length, 'items')

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
                placeholder="Search media and folders..."
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

          {/* Media Type Filter */}
          <select
            value={mediaFilter}
            onChange={(e) => setMediaFilter(e.target.value as 'all' | 'image' | 'video' | 'music')}
            className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white"
          >
            <option value="all">All Media ({ads.length})</option>
            <option value="image">🖼️ Images ({imageCount})</option>
            <option value="video">🎬 Videos ({videoCount})</option>
            <option value="music">🎵 Music ({musicCount})</option>
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
                <h2 className="text-lg font-semibold text-gray-900">All Media</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {sortedAds.length} item{sortedAds.length !== 1 ? 's' : ''} found
                </p>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-600">Loading media...</p>
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
                    className="group relative bg-white rounded-xl border border-gray-200 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/50 transition-all duration-200 overflow-hidden cursor-pointer"
                    onClick={() => {
                      if (ad.mediaType === 'video') {
                        setSelectedVideo(ad)
                      } else if (ad.mediaType === 'music') {
                        setSelectedMusic(ad)
                      } else {
                        setSelectedImage(ad)
                      }
                    }}
                  >
                    <div className="aspect-square relative">
                      {ad.mediaType === 'video' ? (
                        <div className="w-full h-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center relative">
                          {/* Video preview with fallback */}
                          <video
                            src={ad.url}
                            className="w-full h-full object-cover"
                            preload="metadata"
                            muted
                            onError={(e) => {
                              // Hide video on error and show fallback
                              const target = e.target as HTMLVideoElement;
                              target.style.display = 'none';
                            }}
                          />
                          {/* Fallback content and play overlay */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600">
                            <div className="bg-black/20 rounded-full p-4 mb-2">
                              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z"/>
                              </svg>
                            </div>
                            <span className="text-sm font-medium text-gray-700 bg-white/80 px-2 py-1 rounded">
                              Video
                            </span>
                          </div>
                        </div>
                      ) : ad.mediaType === 'music' ? (
                        <div className="w-full h-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center relative">
                          {/* Music cover or default */}
                          {ad.coverUrl ? (
                            <Image
                              src={ad.coverUrl}
                              alt="Album cover"
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-gray-600">
                              <div className="bg-purple-200/50 rounded-full p-6 mb-2">
                                <svg className="w-16 h-16 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                                </svg>
                              </div>
                              <span className="text-sm font-medium text-gray-700 bg-white/80 px-2 py-1 rounded">
                                Music
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <Image
                          src={ad.url}
                          alt={ad.name || 'Generated Ad'}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200" />
                      
                      {/* Preview icon overlay */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <div className="bg-white/90 backdrop-blur-sm rounded-full p-3">
                          {ad.mediaType === 'video' ? (
                            <svg className="w-6 h-6 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          ) : (
                            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          )}
                        </div>
                      </div>
                      
                      {/* Media type indicator */}
                      {ad.mediaType === 'video' && (
                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 text-white text-xs rounded-md">
                          🎬 Video
                        </div>
                      )}
                      {ad.mediaType === 'music' && (
                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-purple-700 text-white text-xs rounded-md">
                          🎵 Music
                        </div>
                      )}
                      
                      <button
                        onClick={() => downloadMedia(ad)}
                        className="absolute top-2 right-2 p-2 bg-white/90 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-white"
                        title={`Download ${ad.mediaType || 'media'}`}
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
                    className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors duration-200 border border-transparent hover:border-gray-200 cursor-pointer"
                    onClick={() => {
                      if (ad.mediaType === 'video') {
                        setSelectedVideo(ad)
                      } else {
                        setSelectedImage(ad)
                      }
                    }}
                  >
                    <div className="w-12 h-12 relative rounded-lg overflow-hidden mr-3 flex-shrink-0">
                      {ad.mediaType === 'video' ? (
                        <div className="w-full h-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                          <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </div>
                      ) : (
                        <Image
                          src={ad.url}
                          alt={ad.name || 'Generated Ad'}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{ad.name || 'Untitled'}</h3>
                      <p className="text-sm text-gray-500 truncate">
                        {ad.mediaType === 'video' ? '🎬 Video' : '🖼️ Image'} • Folder: {ad.folder_name || 'Unknown'} • {new Date(ad.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => downloadMedia(ad)}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                      title={`Download ${ad.mediaType || 'media'}`}
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">No media found</h3>
              <p className="text-gray-600 mb-6">
                {searchTerm ? 'Try adjusting your search terms.' : 'Generate your first image or video to get started.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Video Modal */}
      {selectedVideo && (
        <div 
          className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-2 sm:p-4"
          onClick={() => setSelectedVideo(null)}
        >
          <div 
            className="bg-white rounded-xl sm:rounded-2xl max-w-4xl w-full max-h-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedVideo.name || 'Video Preview'}
              </h3>
              <button
                onClick={() => setSelectedVideo(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <video
                src={selectedVideo.url}
                controls
                autoPlay
                className="w-full rounded-lg"
                style={{ maxHeight: '70vh' }}
              />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 gap-3">
                <p className="text-sm text-gray-500">
                  Created on {new Date(selectedVideo.created_at).toLocaleDateString()}
                </p>
                <button
                  onClick={() => downloadMedia(selectedVideo)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
                >
                  Download Video
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-2 sm:p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div 
            className="bg-white rounded-xl sm:rounded-2xl max-w-4xl w-full max-h-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedImage.name || 'Image Preview'}
              </h3>
              <button
                onClick={() => setSelectedImage(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <div className="relative rounded-lg overflow-hidden" style={{ maxHeight: '70vh' }}>
                <Image
                  src={selectedImage.url}
                  alt={selectedImage.name || 'Generated Image'}
                  width={800}
                  height={600}
                  className="w-full h-auto object-contain"
                  style={{ maxHeight: '70vh' }}
                />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 gap-3">
                <p className="text-sm text-gray-500">
                  Created on {new Date(selectedImage.created_at).toLocaleDateString()}
                </p>
                <button
                  onClick={() => downloadMedia(selectedImage)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
                >
                  Download Image
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Music Modal */}
      {selectedMusic && (
        <div 
          className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-2 sm:p-4"
          onClick={() => setSelectedMusic(null)}
        >
          <div 
            className="bg-white rounded-xl sm:rounded-2xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedMusic.name || 'Music Preview'}
              </h3>
              <button
                onClick={() => setSelectedMusic(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              {/* Album Cover */}
              {selectedMusic.coverUrl && (
                <div className="relative rounded-lg overflow-hidden mb-4">
                  <Image
                    src={selectedMusic.coverUrl}
                    alt="Album cover"
                    width={400}
                    height={400}
                    className="w-full h-auto"
                  />
                </div>
              )}
              
              {/* Audio Player */}
              <audio
                src={selectedMusic.url}
                controls
                autoPlay
                className="w-full mb-4"
              />
              
              {/* Lyrics if available */}
              {selectedMusic.lyrics && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg max-h-48 overflow-y-auto">
                  <p className="text-xs font-medium text-gray-600 mb-2">Lyrics:</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedMusic.lyrics}</p>
                </div>
              )}
              
              {/* Actions */}
              <div className="flex flex-col gap-3">
                <p className="text-sm text-gray-500">
                  Created on {new Date(selectedMusic.created_at).toLocaleDateString()}
                </p>
                <button
                  onClick={() => downloadMedia(selectedMusic)}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm sm:text-base flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download {selectedMusic.coverUrl ? 'Music + Cover' : 'Music'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}