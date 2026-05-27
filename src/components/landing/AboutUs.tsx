import { LeafIcon, PlantIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Reveal from './Reveal'

const quotes = [
  {
    text: '»Egal ob Grillen, Gärtnern oder Kartenspielen – Hauptsache, wir sind beisammen.«',
    source: 'Aus der Sommerrunde',
    icon: PlantIcon,
  },
  {
    text: '»Der Garten ist groß genug für alle, die gerne mitmachen – und für die, die nur am Lagerfeuer mitfeiern.«',
    source: 'Vom letzten Saisonfest',
    icon: LeafIcon,
  },
] as const

function AboutUs() {
  return (
    <Reveal
      as="section"
      className="relative overflow-hidden rounded-[1.5rem] bg-white/75 p-5 shadow-[0_18px_40px_rgba(31,61,43,0.08)] backdrop-blur sm:rounded-[2rem] sm:p-8 sm:shadow-[0_24px_50px_rgba(31,61,43,0.1)]"
      id="ueber-uns"
    >
      <picture>
        <source srcSet="/images/about-bg.avif" type="image/avif" />
        <source srcSet="/images/about-bg.webp" type="image/webp" />
        <img
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden h-full w-full object-cover opacity-[0.08] mix-blend-multiply sm:block"
          loading="lazy"
          src="/images/about-bg.webp"
        />
      </picture>

      <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3 sm:space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-forest-700">
            Über uns
          </p>
          <h2 className="max-w-[16ch] text-3xl text-forest-900 sm:text-4xl lg:text-5xl">
            Ein Garten, viele Hände, ein gemeinsamer Takt.
          </h2>
          <p className="max-w-[58ch] text-base text-forest-700/80 sm:text-lg">
            SV Beet & Bewegung ist unser gemeinsamer Treffpunkt rund um den
            Kleingarten in Wien-Floridsdorf. Wir kochen und grillen zusammen,
            spielen Karten oder Federball, machen Sport, sitzen am Lagerfeuer –
            und versorgen ganz nebenbei die Beete. Auf dieser Seite bündeln wir
            Termine, Zusagen und alles, was rund um das nächste Treffen zu
            klären ist.
          </p>
        </div>

        <div className="grid gap-4">
          <Reveal
            as="figure"
            className="overflow-hidden rounded-[1.25rem] shadow-[0_18px_40px_rgba(31,61,43,0.12)] ring-1 ring-inset ring-white/40 sm:rounded-[1.75rem]"
            delay={120}
          >
            <picture>
              <source srcSet="/images/community.avif" type="image/avif" />
              <source srcSet="/images/community.webp" type="image/webp" />
              <img
                alt="Familien beim gemeinsamen Gärtnern im Kleingarten"
                className="block h-48 w-full object-cover sm:h-56 lg:h-64"
                loading="lazy"
                src="/images/community.webp"
              />
            </picture>
          </Reveal>

          {quotes.map((quote, index) => (
            <Reveal
              as="figure"
              className="group flex gap-4 rounded-[1.25rem] bg-cream-50/90 p-4 text-sm leading-7 text-forest-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition hover:-translate-y-0.5 hover:bg-cream-50 hover:shadow-[0_18px_40px_rgba(31,61,43,0.12)] sm:rounded-[1.75rem] sm:p-5 sm:text-base"
              delay={index * 120 + 240}
              key={quote.source}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest-900/5 text-forest-700 transition group-hover:scale-110 group-hover:bg-leaf-500/20 group-hover:text-forest-900 sm:h-12 sm:w-12">
                <HugeiconsIcon icon={quote.icon} size={24} strokeWidth={1.5} />
              </span>
              <div>
                <blockquote className="font-display text-forest-900 italic">
                  {quote.text}
                </blockquote>
                <figcaption className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-forest-700/70">
                  {quote.source}
                </figcaption>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </Reveal>
  )
}

export default AboutUs
