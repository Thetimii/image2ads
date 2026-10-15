'use client'

import { Icon } from '@/components/studio/StudioIcons'

interface ModelSelectorProps {
  selectedModel: 'nano-banana' | 'nano-banana-pro'
  onSelectModel: (model: 'nano-banana' | 'nano-banana-pro') => void
  selectedResolution: '1K' | '2K' | '4K'
  onSelectResolution: (resolution: '1K' | '2K' | '4K') => void
  disabled?: boolean
  isPro?: boolean
  onShowUpgrade?: () => void
}

const RESOLUTIONS: { value: '1K' | '2K' | '4K'; time: string; note?: string }[] = [
  { value: '1K', time: '~2 min' },
  { value: '2K', time: '~3 min', note: 'Recommended' },
  { value: '4K', time: '~5 min' },
]

export default function ModelSelector({ selectedModel, onSelectModel, selectedResolution, onSelectResolution, disabled, isPro = false, onShowUpgrade }: ModelSelectorProps) {
  return (
    <div className="sc-panel sc-models">
      <div className="sc-model-grid">
        {/* Standard */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelectModel('nano-banana')}
          className={`sc-model ${selectedModel === 'nano-banana' ? 'is-active' : ''}`}
        >
          <div className="sc-model-top">
            <span className="sc-model-name">Standard</span>
          </div>
          <span className="sc-model-desc">Fast, great for testing ideas</span>
          <div className="sc-model-foot">
            <span className="sc-chip">1 credit</span>
            <span>1K–2K · ~1 min</span>
          </div>
        </button>

        {/* Pro */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (!isPro && onShowUpgrade) {
              onShowUpgrade()
              return
            }
            onSelectModel('nano-banana-pro')
          }}
          className={`sc-model ${selectedModel === 'nano-banana-pro' ? 'is-active' : ''}`}
        >
          <div className="sc-model-top">
            <span className="sc-model-name">
              Pro <span className="sc-tag">Up to 4K</span>
            </span>
            {!isPro && <span className="sc-model-lock"><Icon name="lock" /> Paid plans</span>}
          </div>
          <span className="sc-model-desc">Sharpest detail and text, for final ads</span>
          <div className="sc-model-foot">
            <span className="sc-chip">6 credits</span>
            <span>1K–4K · ~3–5 min</span>
          </div>
        </button>
      </div>

      {/* Resolution - only for Pro */}
      {selectedModel === 'nano-banana-pro' && (
        <div className="sc-field">
          <label>Resolution <span>(higher takes longer)</span></label>
          <div className="sc-segment">
            {RESOLUTIONS.map(r => (
              <button
                key={r.value}
                type="button"
                disabled={disabled}
                onClick={() => onSelectResolution(r.value)}
                className={selectedResolution === r.value ? 'is-active' : ''}
              >
                <strong>{r.value}</strong>
                <small>{r.note ? `${r.time} · ${r.note}` : r.time}</small>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
