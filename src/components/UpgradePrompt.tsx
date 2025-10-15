'use client'

interface UpgradePromptProps {
  isOpen: boolean
  onCloseAction: () => void
  onOpenPricingAction: () => void
}

export default function UpgradePrompt({ isOpen, onCloseAction, onOpenPricingAction }: UpgradePromptProps) {
  const handleSeePlans = () => {
    onCloseAction()
    onOpenPricingAction()
  }

  const handleMaybeLater = () => {
    onCloseAction()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] animate-in fade-in duration-300"
        onClick={handleMaybeLater}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-300">
          {/* Header */}
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-8 rounded-t-2xl text-center">
            <div className="text-5xl mb-3">🚀</div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Ready for more?
            </h2>
          </div>

          {/* Body */}
          <div className="p-8">
            <p className="text-gray-700 text-lg mb-6 text-center">
              You've used your <span className="font-semibold text-blue-600">3 free images</span> — unlock unlimited images and even AI video generation with one of our plans!
            </p>

            <div className="space-y-3">
              <button
                onClick={handleSeePlans}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40"
              >
                See Plans ✨
              </button>
              
              <button
                onClick={handleMaybeLater}
                className="w-full border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-medium py-4 px-6 rounded-xl transition-all duration-200"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
