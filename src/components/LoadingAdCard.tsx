'use client'

import { GenerationLoading } from './LoadingAnimations'

interface LoadingAdCardProps {
  customName?: string
}

export default function LoadingAdCard({ customName }: LoadingAdCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 relative overflow-hidden shadow-sm">
      {/* Loading skeleton for image */}
      <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 rounded-t-xl overflow-hidden relative">
        {/* Enhanced generating indicator */}
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50/50 to-purple-50/50">
          <div className="text-center">
            {/* AI Icon with animation */}
            <div className="relative mb-4">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm animate-pulse">
                  AI
                </div>
              </div>
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-16 h-16 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
            </div>
            
            <p className="text-sm font-semibold text-gray-800 mb-1">Creating Magic...</p>
            <p className="text-xs text-gray-600">AI is working on your ad</p>
            
            {/* Animated progress dots */}
            <div className="flex justify-center space-x-1 mt-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
        
        {/* Shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer opacity-50" 
             style={{ 
               backgroundSize: '200% 100%',
               animation: 'shimmer 2s infinite linear'
             }} />
      </div>
      
      {/* Content area */}
      <div className="p-4">
        {/* Title with custom name or placeholder */}
        <div className="mb-3">
          {customName ? (
            <h3 className="font-medium text-gray-900 text-sm truncate">
              {customName}
            </h3>
          ) : (
            <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: '70%' }}></div>
          )}
          <div className="h-3 bg-gray-200 rounded animate-pulse mt-2" style={{ width: '50%' }}></div>
        </div>
        
        {/* Disabled action buttons */}
        <div className="flex items-center space-x-2">
          <div className="flex-1 bg-gray-100 text-gray-500 text-xs px-3 py-2 rounded-lg cursor-not-allowed flex items-center justify-center">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
            Rename
          </div>
          <div className="flex-1 bg-gray-100 text-gray-500 text-xs px-3 py-2 rounded-lg cursor-not-allowed flex items-center justify-center">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Download
          </div>
        </div>
      </div>
      
      {/* Pulse effect overlay */}
      <div className="absolute inset-0 bg-blue-500/5 animate-pulse"></div>
      
      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite linear;
        }
      `}</style>
    </div>
  )
}