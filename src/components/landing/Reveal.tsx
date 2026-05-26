import {
  type CSSProperties,
  type ElementType,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import { cn } from '~/lib/ui-utils'

type RevealProps = {
  children: ReactNode
  as?: ElementType
  className?: string
  delay?: number
  id?: string
}

function Reveal({
  children,
  as: Tag = 'div',
  className,
  delay = 0,
  id,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(() => {
    if (typeof document === 'undefined') return false
    return document.getElementById('root')?.dataset.prerendered === 'true'
  })

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.disconnect()
            break
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const style = { '--reveal-delay': `${delay}ms` } as CSSProperties

  return (
    <Tag
      className={cn('reveal', visible && 'is-visible', className)}
      id={id}
      ref={ref}
      style={style}
    >
      {children}
    </Tag>
  )
}

export default Reveal
