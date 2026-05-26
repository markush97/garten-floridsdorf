import { LeafIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

function WavyDivider() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center justify-center gap-3 text-forest-700/45"
    >
      <span className="h-px w-12 bg-forest-700/25 sm:w-20" />
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-forest-700/30" />
      <span className="inline-flex animate-float text-leaf-500/70">
        <HugeiconsIcon icon={LeafIcon} size={20} strokeWidth={1.5} />
      </span>
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-forest-700/30" />
      <span className="h-px w-12 bg-forest-700/25 sm:w-20" />
    </div>
  )
}

export default WavyDivider
