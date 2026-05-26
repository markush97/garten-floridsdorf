import { LeafIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'

const leaves = Array.from({ length: 14 }, (_, i) => {
  const left = (i * 7 + 4) % 100
  const size = 18 + ((i * 7) % 18)
  const drift = ((i % 5) - 2) * 40
  const delay = (i * 160) % 1800
  const duration = 4200 + ((i * 311) % 1800)
  const opacity = 0.55 + ((i * 13) % 30) / 100
  return { left, size, drift, delay, duration, opacity }
})

const TOTAL_DURATION = 7000

function IntroLeaves() {
  const [show, setShow] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShow(false)
      return
    }
    const timeout = window.setTimeout(() => setShow(false), TOTAL_DURATION)
    return () => window.clearTimeout(timeout)
  }, [])

  if (!show) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
    >
      {leaves.map((leaf) => (
        <span
          key={`l-${leaf.left}-${leaf.delay}`}
          className="absolute top-0 text-leaf-500"
          style={
            {
              left: `${leaf.left}%`,
              animation: `leaf-fall ${leaf.duration}ms cubic-bezier(0.45,0,0.55,1) ${leaf.delay}ms both`,
              '--leaf-drift': `${leaf.drift}px`,
              '--leaf-opacity': leaf.opacity,
            } as CSSProperties
          }
        >
          <HugeiconsIcon icon={LeafIcon} size={leaf.size} strokeWidth={1.5} />
        </span>
      ))}
    </div>
  )
}

export default IntroLeaves
