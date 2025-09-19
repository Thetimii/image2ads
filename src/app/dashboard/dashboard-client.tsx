'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { Profile, Folder } from '@/lib/validations'
import DashboardLayout from '@/components/DashboardLayout'
import OnboardingTutorial from '@/components/OnboardingTutorial'

interface DashboardClientProps {
  user: User
  profile: Profile
  initialFolders: Folder[]
}

type SortOption = 'name' | 'date' | 'name-desc' | 'date-desc'
type ViewMode = 'grid' | 'list'

export default function DashboardClient({ user, profile, initialFolders }: DashboardClientProps) {
  const [folders, setFolders] = useState(initialFolders)
  const [isCreating, setIsCreating] = useState(false)
  const [loadingFolderId, setLoadingFolderId] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('date-desc')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [showTutorial, setShowTutorial] = useState(!profile.tutorial_completed)
  const router = useRouter()

  const handleFolderClick = (folderId: string) => {
    setLoadingFolderId(folderId)
    router.push(`/folders/${folderId}`)
  }

  const handleTutorialComplete = () => {
    setShowTutorial(false)
  }

  const handleTutorialSkip = () => {
    setShowTutorial(false)
  }

  // Filter and sort folders based on search and sort options
  const filteredAndSortedFolders = useMemo(() => {
    let result = [...folders]

    // Filter by search query
    if (searchQuery.trim()) {
      result = result.filter(folder => 
        folder.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Sort folders
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'name-desc':
          return b.name.localeCompare(a.name)
        case 'date':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'date-desc':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

    return result
  }, [folders, searchQuery, sortBy])

  const createFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim()) return

    setIsCreating(true)
    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newFolderName.trim() }),
      })

      if (response.ok) {
        const { folder } = await response.json()
        setFolders([folder, ...folders])
        setNewFolderName('')
      } else {
        console.error('Failed to create folder')
      }
    } catch (error) {
      console.error('Error creating folder:', error)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <DashboardLayout user={user} profile={profile}>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Create</h1>
          <p className="text-gray-600">
            Organize your images into folders and start generating professional ads with AI.
          </p>
        </div>

        {/* Create New Folder */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Folder</h2>
          <form onSubmit={createFolder} className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name (e.g., 'Product Photos', 'Summer Campaign')"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
              />
            </div>
            <button
              type="submit"
              disabled={isCreating || !newFolderName.trim()}
              data-tutorial="create-button"
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-500/20"
            >
              {isCreating ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Creating...</span>
                </div>
              ) : (
                'Create Folder'
              )}
            </button>
          </form>
        </div>

        {/* Folders Section */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Your Folders</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {folders.length} {folders.length === 1 ? 'folder' : 'folders'} • Organize your images and create stunning ads
                </p>
              </div>
              
              {folders.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Search */}
                  <div className="relative">
                    <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search folders..."
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-sm w-full sm:w-48"
                    />
                  </div>

                  {/* Sort */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-sm bg-white"
                  >
                    <option value="date-desc">Newest first</option>
                    <option value="date">Oldest first</option>
                    <option value="name">Name A-Z</option>
                    <option value="name-desc">Name Z-A</option>
                  </select>

                  {/* View Toggle */}
                  <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                        viewMode === 'grid'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                        viewMode === 'list'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {filteredAndSortedFolders.length > 0 ? (
            <div className={viewMode === 'grid' ? 
              "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6" : 
              "divide-y divide-gray-200"
            }>
              {filteredAndSortedFolders.map((folder) => (
                viewMode === 'grid' ? (
                  // Grid View
                  <button
                    key={folder.id}
                    onClick={() => handleFolderClick(folder.id)}
                    disabled={loadingFolderId === folder.id}
                    data-folder-id={folder.id}
                    className="group relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 hover:from-blue-50 hover:to-purple-50 transition-all duration-200 border border-gray-200 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/50 disabled:opacity-50 disabled:cursor-not-allowed w-full text-left"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center group-hover:bg-gradient-to-r group-hover:from-blue-500 group-hover:to-purple-500 transition-all duration-200 shadow-sm">
                        {loadingFolderId === folder.id ? (
                          <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                        ) : (
                          <svg className="w-6 h-6 text-gray-600 group-hover:text-white transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        )}
                      </div>
                      {loadingFolderId === folder.id ? (
                        <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                      ) : (
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </div>
                    
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-900 transition-colors duration-200">
                      {folder.name}
                      {loadingFolderId === folder.id && (
                        <span className="ml-2 text-sm text-blue-500">Loading...</span>
                      )}
                    </h3>
                    
                    <p className="text-sm text-gray-500 group-hover:text-blue-600 transition-colors duration-200">
                      Created {new Date(folder.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </button>
                ) : (
                  // List View
                  <button
                    key={folder.id}
                    onClick={() => handleFolderClick(folder.id)}
                    disabled={loadingFolderId === folder.id}
                    data-folder-id={folder.id}
                    className="group flex items-center justify-between p-4 hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed w-full text-left"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center group-hover:from-blue-600 group-hover:to-purple-600 transition-all duration-200">
                        {loadingFolderId === folder.id ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-900 transition-colors duration-200">
                          {folder.name}
                          {loadingFolderId === folder.id && (
                            <span className="ml-2 text-sm text-blue-500">Loading...</span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Created {new Date(folder.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                    {loadingFolderId === folder.id ? (
                      <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </button>
                )
              ))}
            </div>
          ) : folders.length === 0 ? (
            // No folders at all
            <div className="text-center py-16 px-6">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No folders yet</h3>
              <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                Create your first folder to start organizing your images and generating professional ads.
              </p>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => document.querySelector('input')?.focus()}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
                >
                  Create First Folder
                </button>
              </div>
            </div>
          ) : (
            // No search results
            <div className="text-center py-16 px-6">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No folders found</h3>
              <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                No folders match your search &quot;{searchQuery}&quot;. Try a different search term.
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200"
              >
                Clear search
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tutorial */}
      {showTutorial && (
        <OnboardingTutorial
          onCompleteAction={handleTutorialComplete}
          onSkipAction={handleTutorialSkip}
        />
      )}
    </DashboardLayout>
  )
}