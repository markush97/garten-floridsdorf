import { HeartCheckIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

function Footer() {
  return (
    <footer className="rounded-[1.5rem] bg-white/65 px-5 py-5 shadow-[0_16px_32px_rgba(31,61,43,0.08)] ring-1 ring-inset ring-white/40 backdrop-blur-md sm:rounded-[2rem] sm:px-8 sm:py-6 sm:shadow-[0_20px_40px_rgba(31,61,43,0.08)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <img
            alt="Logo von SV Beet & Bewegung"
            className="h-12 w-auto rounded-full bg-cream-50/60 p-1 transition hover:rotate-[6deg] sm:h-14"
            src="/brand/logo.png"
          />
          <div>
            <p className="font-display text-lg text-forest-900 sm:text-xl">
              SV Beet & Bewegung
            </p>
            <p className="text-sm text-forest-700/80">
              Treffen, Termine und Pläne rund um unseren Garten in Floridsdorf.
            </p>
          </div>
        </div>

        <p className="inline-flex items-center gap-2 text-sm text-forest-700/75">
          <span>Gemacht mit</span>
          <HugeiconsIcon
            className="text-beet-700"
            icon={HeartCheckIcon}
            size={16}
            strokeWidth={2}
          />
          <span>für unseren Garten in Floridsdorf.</span>
        </p>
      </div>
    </footer>
  )
}

export default Footer
