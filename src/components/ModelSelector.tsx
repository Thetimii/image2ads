'use client'

import { useState } from 'react'

interface ModelSelectorProps {
  selectedModel: 'nano-banana' | 'nano-banana-pro'
  onSelectModel: (model: 'nano-banana' | 'nano-banana-pro') => void
  selectedResolution: '1K' | '2K' | '4K'
  onSelectResolution: (resolution: '1K' | '2K' | '4K') => void
  disabled?: boolean
}

export default function ModelSelector({ selectedModel, onSelectModel, selectedResolution, onSelectResolution, disabled }: ModelSelectorProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        AI Model & Resolution
      </label>
      <div className="grid grid-cols-2 gap-3">
        {/* Nano Banana - Regular */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelectModel('nano-banana')}
          className={`
            relative p-4 rounded-lg border-2 transition-all text-left
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-purple-300'}
            ${
              selectedModel === 'nano-banana'
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }
          `}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🍌</span>
              <div>
                <div className="font-semibold text-gray-900">Nano Banana</div>
                <div className="text-xs text-gray-500">Standard Quality</div>
              </div>
            </div>
            {selectedModel === 'nano-banana' && (
              <svg className="w-5 h-5 text-purple-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              1 Credit
            </span>
            <span className="text-xs text-gray-500">1K-2K resolution</span>
          </div>
        </button>

        {/* Nano Banana Pro - 4K */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelectModel('nano-banana-pro')}
          className={`
            relative p-4 rounded-lg border-2 transition-all text-left
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-purple-300'}
            ${
              selectedModel === 'nano-banana-pro'
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }
          `}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🍌</span>
              <div>
                <div className="font-semibold text-gray-900 flex items-center gap-2">
                  Nano Banana Pro
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                    UP TO 4K
                  </span>
                </div>
                <div className="text-xs text-gray-500">Ultra High Quality</div>
                <div className="text-xs text-amber-600 font-medium mt-0.5">⏱️ ~3-5 min</div>
              </div>
            </div>
            {selectedModel === 'nano-banana-pro' && (
              <svg className="w-5 h-5 text-purple-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              6 Credits
            </span>
            <span className="text-xs text-gray-500">1K-4K resolution</span>
          </div>
        </button>
      </div>

      {/* Resolution Selector - Only show for Pro model */}
      {selectedModel === 'nano-banana-pro' && (
        <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Resolution (Higher = Longer processing time)
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelectResolution('1K')}
              className={`p-3 rounded-lg border-2 transition-all text-center ${
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-purple-300'
              } ${
                selectedResolution === '1K'
                  ? 'border-purple-500 bg-white'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="font-semibold text-sm text-gray-900">1K</div>
              <div className="text-xs text-gray-500 mt-1">~2 min</div>
            </button>
            
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelectResolution('2K')}
              className={`p-3 rounded-lg border-2 transition-all text-center ${
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-purple-300'
              } ${
                selectedResolution === '2K'
                  ? 'border-purple-500 bg-white'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="font-semibold text-sm text-gray-900">2K</div>
              <div className="text-xs text-gray-500 mt-1">~3 min</div>
              <div className="text-xs text-purple-600 font-medium">Recommended</div>
            </button>
            
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelectResolution('4K')}
              className={`p-3 rounded-lg border-2 transition-all text-center ${
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-purple-300'
              } ${
                selectedResolution === '4K'
                  ? 'border-purple-500 bg-white'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="font-semibold text-sm text-gray-900">4K</div>
              <div className="text-xs text-gray-500 mt-1">~5 min</div>
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-3 text-center">
            💡 Higher resolutions provide better quality but take longer to generate
          </p>
        </div>
      )}
    </div>
  )
}
