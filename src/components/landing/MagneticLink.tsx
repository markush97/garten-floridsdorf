import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { useCallback, useRef } from 'react'

type MagneticLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode
  strength?: number
  radius?: number
}

function MagneticLink({
  children,
  strength = 0.35,
  radius = 120,
  onMouseMove,
  onMouseLeave,
  style,
  ...rest
}: MagneticLinkProps) {
  const ref = useRef<HTMLAnchorElement | null>(null)

  const handleMove = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      const el = ref.current
      if (!el) return
      if (window.matchMedia('(pointer: coarse)').matches) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = event.clientX - cx
      const dy = event.clientY - cy
      const distance = Math.hypot(dx, dy)
      if (distance > radius) {
        el.style.transform = 'translate3d(0, 0, 0)'
        return
      }
      el.style.transform = `translate3d(${dx * strength}px, ${dy * strength}px, 0)`
      onMouseMove?.(event)
    },
    [strength, radius, onMouseMove],
  )

  const handleLeave = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      const el = ref.current
      if (el) el.style.transform = 'translate3d(0, 0, 0)'
      onMouseLeave?.(event)
    },
    [onMouseLeave],
  )

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Anchor with magnetic hover is purely cosmetic; navigation still works via click.
    <a
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{
        transition: 'transform 280ms cubic-bezier(0.22,1,0.36,1)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </a>
  )
}

export default MagneticLink
