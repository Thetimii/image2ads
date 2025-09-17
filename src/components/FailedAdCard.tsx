'use client'

interface FailedAdCardProps {
  customName?: string
  errorMessage?: string
  onDeleteAction: () => void
}

export default function FailedAdCard({ customName, errorMessage, onDeleteAction }: FailedAdCardProps) {
  return (
    <div className="bg-red-50 rounded-xl p-4 border border-red-200 relative">
      {/* Delete button */}
      <button
        onClick={onDeleteAction}
        className="absolute top-2 right-2 p-1 bg-red-100 hover:bg-red-200 rounded-full transition-colors z-10"
        title="Delete failed job"
      >
        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="aspect-square bg-red-100 rounded-lg overflow-hidden mb-3 flex items-center justify-center">
        {/* Error icon */}
        <div className="text-red-400">
          <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
      </div>
      
      <div className="space-y-2">
        <h3 className="font-semibold text-sm text-red-900">
          {customName || 'Failed Job'}
        </h3>
        
        <div className="flex items-center justify-center">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Failed
          </span>
        </div>

        {errorMessage && (
          <p className="text-xs text-red-600 mt-2 line-clamp-2" title={errorMessage}>
            {errorMessage}
          </p>
        )}
      </div>
    </div>
  )
}