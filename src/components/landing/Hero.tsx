import { ArrowRight01Icon, LeafIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { CSSProperties } from 'react'
import MagneticLink from './MagneticLink'

const floatingLeaves = [
  { top: '14%', left: '6%', size: 28, delay: '0s', rot: '-12deg' },
  { top: '70%', left: '12%', size: 22, delay: '1.4s', rot: '18deg' },
  { top: '22%', left: '92%', size: 32, delay: '0.7s', rot: '24deg' },
  { top: '78%', left: '88%', size: 24, delay: '2.1s', rot: '-20deg' },
  { top: '36%', left: '74%', size: 18, delay: '3s', rot: '8deg' },
] as const

const headlineWords = [
  'Familiengarten,',
  'Termine',
  'und',
  'Abstimmungen',
  'an',
  'einem',
  'Ort.',
] as const

const SPROUT_BASE_DELAY = 120 + 3 * 90 + 320

function HeroSprout() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 56"
      className="ml-1 inline-block h-[0.78em] w-auto -translate-y-[0.16em] align-baseline text-leaf-500"
    >
      <title>Sprout</title>
      <path
        className="sprout-stem"
        d="M24 54 C24 40, 24 32, 24 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        style={{ '--sprout-delay': `${SPROUT_BASE_DELAY}ms` } as CSSProperties}
      />
      <path
        className="sprout-leaf"
        d="M24 26 C14 24, 8 18, 6 10 C16 10, 22 16, 24 26 Z"
        fill="currentColor"
        style={
          {
            '--leaf-delay': `${SPROUT_BASE_DELAY + 700}ms`,
            '--leaf-origin': '24px 26px',
            '--leaf-rot': '-6deg',
          } as CSSProperties
        }
      />
      <path
        className="sprout-leaf"
        d="M24 20 C34 18, 40 12, 42 4 C32 4, 26 10, 24 20 Z"
        fill="currentColor"
        style={
          {
            '--leaf-delay': `${SPROUT_BASE_DELAY + 900}ms`,
            '--leaf-origin': '24px 20px',
            '--leaf-rot': '6deg',
          } as CSSProperties
        }
      />
    </svg>
  )
}

function Hero() {
  return (
    <section className="reveal is-visible relative overflow-hidden rounded-[1.75rem] bg-forest-900 text-cream-50 shadow-[0_24px_50px_rgba(31,61,43,0.22)] sm:rounded-[2.5rem] sm:shadow-[0_32px_70px_rgba(31,61,43,0.24)]">
      <div
        aria-hidden="true"
        className="absolute inset-0 scale-110 bg-cover bg-center opacity-25 blur-2xl"
        style={{
          backgroundImage:
            "image-set(url('/images/banner.avif') type('image/avif'), url('/images/banner.webp') type('image/webp'))",
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(31,61,43,0.94)_0%,rgba(45,82,57,0.9)_45%,rgba(122,31,61,0.82)_100%)]" />

      <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
        <span className="mesh-blob mesh-blob-a left-[-10%] top-[-15%] h-[55%] w-[55%]" />
        <span className="mesh-blob mesh-blob-b right-[-12%] bottom-[-20%] h-[65%] w-[65%]" />
        <span className="mesh-blob mesh-blob-c left-[30%] top-[35%] h-[45%] w-[45%]" />
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(122,181,46,0.18),transparent_45%),radial-gradient(circle_at_82%_78%,rgba(245,240,225,0.12),transparent_50%)]" />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden sm:block"
      >
        {floatingLeaves.map((leaf) => (
          <span
            className="absolute animate-float text-leaf-500/60"
            key={`${leaf.top}-${leaf.left}`}
            style={
              {
                top: leaf.top,
                left: leaf.left,
                animationDelay: leaf.delay,
                '--rot': leaf.rot,
              } as CSSProperties
            }
          >
            <HugeiconsIcon icon={LeafIcon} size={leaf.size} strokeWidth={1.5} />
          </span>
        ))}
      </div>

      <div className="relative grid gap-6 px-5 py-7 sm:gap-7 sm:px-8 sm:py-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:px-12 lg:py-14">
        <div className="space-y-5 sm:space-y-6">
          <p
            className="reveal is-visible inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-leaf-500 ring-1 ring-inset ring-leaf-500/30 backdrop-blur"
            style={{ '--reveal-delay': '80ms' } as CSSProperties}
          >
            <span className="inline-block h-1.5 w-1.5 animate-pulse-soft rounded-full bg-leaf-500" />
            Familiengarten Wien
          </p>
          <h1 className="max-w-[14ch] font-display text-[2.25rem] leading-[1.08] text-cream-50 sm:text-6xl sm:leading-[1.05] lg:text-7xl">
            {headlineWords.map((word, i) => (
              <span
                className="word-mask mr-[0.25em]"
                key={word}
                style={{ '--word-i': i } as CSSProperties}
              >
                <span>
                  {word === 'Abstimmungen' ? (
                    <span className="inline-flex items-end gap-1 pr-1">
                      <span className="text-leaf-500">{word}</span>
                      <HeroSprout />
                    </span>
                  ) : (
                    word
                  )}
                </span>
              </span>
            ))}
          </h1>
          <p
            className="reveal is-visible max-w-[58ch] text-base text-cream-50/85 sm:text-lg lg:text-xl"
            style={{ '--reveal-delay': '900ms' } as CSSProperties}
          >
            Zusammen kochen, spielen, gärtnern, Termine abstimmen – mit allen,
            die im Floridsdorfer Garten regelmäßig dabei sind.
          </p>
          <div
            className="reveal is-visible flex flex-col gap-3 sm:flex-row sm:flex-wrap"
            style={{ '--reveal-delay': '1100ms' } as CSSProperties}
          >
            <MagneticLink
              className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cream-50 px-6 text-sm font-semibold text-forest-900 shadow-[0_12px_30px_rgba(245,240,225,0.18)] hover:shadow-[0_18px_40px_rgba(122,181,46,0.35)] sm:text-base"
              href="#aktuelle-umfrage"
            >
              Zur aktuellen Terminabstimmung
              <span className="inline-flex animate-nudge-right group-hover:animate-none">
                <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
              </span>
            </MagneticLink>
            <MagneticLink
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-white/12 px-6 text-sm font-semibold text-cream-50 ring-1 ring-inset ring-white/18 backdrop-blur hover:bg-white/20 sm:text-base"
              href="#was-wir-tun"
              strength={0.25}
            >
              Bereiche ansehen
            </MagneticLink>
          </div>
        </div>

        <div
          className="reveal is-visible rounded-[1.5rem] bg-white/12 p-5 ring-1 ring-inset ring-white/15 backdrop-blur-md sm:rounded-[2rem] sm:p-6"
          style={{ '--reveal-delay': '1300ms' } as CSSProperties}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-leaf-500">
            Was uns verbindet
          </p>
          <dl className="mt-5 grid gap-4 text-sm text-cream-50/85 sm:text-base">
            <div>
              <dt className="font-semibold text-cream-50">Treffen im Garten</dt>
              <dd>
                Grillen, Spieleabende, Sport im Grünen, Lagerfeuer und ganz
                nebenbei die Beete versorgen – wann immer Zeit ist.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-cream-50">Wer mitmacht</dt>
              <dd>
                Ein kleiner Kernkreis und viele Freundinnen, Freunde und
                Bekannte, die regelmäßig vorbeischauen und mitmachen.
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}

export default Hero
