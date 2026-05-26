import { LeafIcon, PlantIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Reveal from './Reveal'

const families = [
  {
    name: 'Familie A',
    text: 'Schafft den organisatorischen Rahmen und hält den gemeinsamen Gartenkalender aktuell.',
    icon: PlantIcon,
  },
  {
    name: 'Familie B',
    text: 'Bringt Beetplanung, Ernteideen und den sportlichen Teil der Treffen zusammen.',
    icon: LeafIcon,
  },
] as const

function AboutUs() {
  return (
    <Reveal
      as="section"
      className="grid gap-6 rounded-[1.5rem] bg-white/75 p-5 shadow-[0_18px_40px_rgba(31,61,43,0.08)] backdrop-blur sm:rounded-[2rem] sm:p-8 sm:shadow-[0_24px_50px_rgba(31,61,43,0.1)] lg:grid-cols-[1.1fr_0.9fr]"
      id="ueber-uns"
    >
      <div className="space-y-3 sm:space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-forest-700">
          Über uns
        </p>
        <h2 className="max-w-[14ch] text-3xl text-forest-900 sm:text-4xl lg:text-5xl">
          Zwei Familien, ein Garten und ein klarer gemeinsamer Takt.
        </h2>
        <p className="max-w-[58ch] text-base text-forest-700/80 sm:text-lg">
          SV Beet & Bewegung verbindet Gartenarbeit, spontane Treffen und die
          Abstimmung von Terminen. Die Seite wird Schritt für Schritt zur
          gemeinsamen Anlaufstelle für Planung, Zusagen und finale Termine.
        </p>
      </div>

      <div className="grid gap-4">
        {families.map((family, index) => (
          <Reveal
            as="article"
            className="group flex gap-4 rounded-[1.25rem] bg-cream-50/90 p-4 text-sm leading-7 text-forest-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition hover:-translate-y-0.5 hover:bg-cream-50 hover:shadow-[0_18px_40px_rgba(31,61,43,0.12)] sm:rounded-[1.75rem] sm:p-5 sm:text-base"
            delay={index * 120 + 120}
            key={family.name}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest-900/5 text-forest-700 transition group-hover:scale-110 group-hover:bg-leaf-500/20 group-hover:text-forest-900 sm:h-12 sm:w-12">
              <HugeiconsIcon icon={family.icon} size={24} strokeWidth={1.5} />
            </span>
            <div>
              <p className="font-semibold text-forest-900">{family.name}</p>
              <p className="mt-1">{family.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Reveal>
  )
}

export default AboutUs
