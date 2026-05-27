import { useEffect, useState } from 'react'
import { cn } from '~/lib/ui-utils'

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 320)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      aria-label="Nach oben scrollen"
      className={cn(
        'fixed bottom-6 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-forest-900 text-cream-50 shadow-[0_4px_18px_rgba(31,61,43,0.28)] ring-1 ring-inset ring-white/10 transition-all duration-300 sm:bottom-8 sm:right-6',
        visible
          ? 'pointer-events-auto translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-4 opacity-0',
      )}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      type="button"
    >
      <svg
        aria-hidden="true"
        fill="none"
        height="20"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
        viewBox="0 0 24 24"
        width="20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  )
}
