'use client'

import { useRef, useState } from 'react'

interface DiscountWheelProps {
  onCloseAction: () => void
  onClaimAction: (discount: number, couponId: string) => void
}

const SEGMENTS = [
  { label: '10% OFF', value: 10, color: '#FF6B6B', coupon: 'fNFar3d8' },
  { label: '25% OFF', value: 25, color: '#4ECDC4', coupon: 'JnmSWtst' },
  { label: '30% OFF', value: 30, color: '#FFD93D', coupon: '1X4fnTcK' },
  { label: '10% OFF', value: 10, color: '#95E1D3', coupon: 'fNFar3d8' },
  { label: '25% OFF', value: 25, color: '#F38181', coupon: 'JnmSWtst' },
  { label: '30% OFF', value: 30, color: '#AA96DA', coupon: '1X4fnTcK' },
  { label: '10% OFF', value: 10, color: '#FCBAD3', coupon: 'fNFar3d8' },
  { label: '25% OFF', value: 25, color: '#A8D8EA', coupon: 'JnmSWtst' },
]

export default function DiscountWheel({ onCloseAction, onClaimAction }: DiscountWheelProps) {
  const wheelRef = useRef<HTMLDivElement | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<number | null>(null)
  const [coupon, setCoupon] = useState<string | null>(null)

  console.log('🎡 [DiscountWheel] Component rendered!')

  const spin = () => {
    if (spinning) return
    setSpinning(true)
    // Randomly pick one of the segments by index
    const segmentIndex = Math.floor(Math.random() * SEGMENTS.length)
    const pick = SEGMENTS[segmentIndex]
    console.log('🎯 Wheel spinning to:', { segmentIndex, discount: pick.value, coupon: pick.coupon })
    // Calculate rotation so the wheel lands on the chosen segment
    const baseRotations = 6 // number of full spins
    const randomOffset = Math.random() * 20 - 10 // small offset
    const degPerSeg = 360 / SEGMENTS.length
    const targetDeg = 360 * baseRotations + (segmentIndex * degPerSeg) + degPerSeg / 2 + randomOffset

    if (wheelRef.current) {
      wheelRef.current.style.transition = 'transform 4s cubic-bezier(0.2, 0.9, 0.2, 1)'
      wheelRef.current.style.transform = `rotate(${targetDeg}deg)`
    }

    // After spin animation ends
    setTimeout(() => {
      setSpinning(false)
      setResult(pick.value)
      setCoupon(pick.coupon)
    }, 4200)
  }

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-lg w-full" style={{ boxShadow: '0 0 60px rgba(0,0,0,0.3)' }}>
        <div className="text-center">
          <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            🎉 Congratulations!
          </h3>
          <p className="text-sm text-gray-600 mt-2">You've used your free credits! Spin the wheel for an exclusive discount on any plan.</p>
        </div>

        <div className="mt-8 flex items-center justify-center">
          <div className="w-80 h-80 relative">
            {/* Pointer - at top */}
            <div className="absolute left-1/2 transform -translate-x-1/2 -top-4 z-10">
              <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-red-500 drop-shadow-lg" />
            </div>

            {/* Wheel with labels */}
            <div ref={wheelRef} className="w-full h-full rounded-full overflow-hidden border-4 border-gray-200 shadow-xl relative">
              {/* Segments with conic gradient background */}
              <div
                className="w-full h-full rounded-full absolute inset-0"
                style={{
                  background: (() => {
                    const deg = 360 / SEGMENTS.length
                    const parts = SEGMENTS.map((s, i) => `${s.color} ${i * deg}deg ${(i + 1) * deg}deg`)
                    return `conic-gradient(${parts.join(', ')})`
                  })(),
                }}
              />
              
              {/* Labels on each segment */}
              {SEGMENTS.map((segment, index) => {
                const deg = 360 / SEGMENTS.length
                const angle = (index * deg) + (deg / 2) - 90 // -90 to start from top
                const radian = (angle * Math.PI) / 180
                const radius = 100 // Distance from center in pixels
                const x = Math.cos(radian) * radius
                const y = Math.sin(radian) * radius
                
                return (
                  <div
                    key={index}
                    className="absolute text-xs font-bold text-gray-800 whitespace-nowrap"
                    style={{
                      left: '50%',
                      top: '50%',
                      transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${angle + 90}deg)`,
                      textShadow: '0 1px 2px rgba(255,255,255,0.8)',
                    }}
                  >
                    {segment.label}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          {!result ? (
            <button 
              onClick={spin} 
              disabled={spinning} 
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition disabled:opacity-50 font-semibold text-lg"
            >
              {spinning ? '🎰 Spinning…' : '🎯 Spin the Wheel'}
            </button>
          ) : (
            <>
              <div className="text-center bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-xl w-full">
                <div className="text-2xl font-bold text-purple-600">🎊 You won {result}% OFF! 🎊</div>
                <div className="text-sm text-gray-600 mt-2">Choose your plan below and apply your discount at checkout</div>
              </div>
              <div className="flex gap-3 mt-2 w-full">
                <button
                  onClick={() => {
                    if (result !== null && coupon) {
                      onClaimAction(result, coupon)
                    }
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition font-semibold"
                >
                  ✨ Claim Discount
                </button>
                <button 
                  onClick={onCloseAction} 
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl transition font-medium"
                >
                  Maybe Later
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
