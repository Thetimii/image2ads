'use client'

interface LoadingAdCardProps {
  customName?: string
}

export default function LoadingAdCard({ customName }: LoadingAdCardProps) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 relative overflow-hidden">
      {/* Loading skeleton for image */}
      <div className="aspect-square bg-gradient-to-br from-gray-200 to-gray-300 rounded-lg overflow-hidden mb-3 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" 
             style={{ 
               backgroundSize: '200% 100%',
               animation: 'shimmer 2s infinite linear'
             }} />
        
        {/* Generating indicator */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm font-medium text-gray-600">Generating...</p>
            <p className="text-xs text-gray-500 mt-1">This may take a minute</p>
          </div>
        </div>
      </div>
      
      {/* Loading skeleton for title */}
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded animate-pulse">
          {customName && (
            <div className="h-full bg-blue-200 rounded" style={{ width: '70%' }}>
              <span className="sr-only">{customName}</span>
            </div>
          )}
        </div>
        <div className="h-3 bg-gray-200 rounded animate-pulse" style={{ width: '50%' }}></div>
      </div>
      
      {/* Disabled action buttons */}
      <div className="flex items-center space-x-2 mt-3">
        <div className="flex-1 bg-gray-300 text-gray-500 text-xs px-3 py-2 rounded-lg cursor-not-allowed">
          Rename
        </div>
        <div className="flex-1 bg-gray-300 text-gray-500 text-xs px-3 py-2 rounded-lg cursor-not-allowed">
          Download
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