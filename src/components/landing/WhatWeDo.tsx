import {
  AppleIcon,
  PlantIcon,
  RunningShoesIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import Reveal from './Reveal'

const items = [
  {
    title: 'Beet',
    text: 'Aussaat, Pflege und gemeinsame Arbeitstage entstehen direkt aus einer aktiven Umfrage.',
    icon: PlantIcon,
    accent: 'from-leaf-500/30 to-leaf-500/0',
  },
  {
    title: 'Ernte',
    text: 'Sobald Termine feststehen, lässt sich der finale Tag für Ernte, Jause oder Grillrunde markieren.',
    icon: AppleIcon,
    accent: 'from-beet-700/30 to-beet-700/0',
  },
  {
    title: 'Bewegung',
    text: 'Auch Spaziergänge, Gartenrunden und spontane Familienaktionen passen in denselben Ablauf.',
    icon: RunningShoesIcon,
    accent: 'from-wood-600/30 to-wood-600/0',
  },
] as const

function WhatWeDo() {
  return (
    <section className="space-y-5 sm:space-y-6" id="was-wir-tun">
      <Reveal className="space-y-2 px-1 sm:space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-forest-700">
          Was wir tun
        </p>
        <h2 className="max-w-[15ch] text-3xl text-forest-900 sm:text-4xl lg:text-5xl">
          Drei Themenfelder, ein gemeinsamer Ablauf.
        </h2>
      </Reveal>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
        {items.map((item, index) => (
          <Reveal
            as="article"
            className="group relative overflow-hidden rounded-[1.5rem] bg-white/75 p-5 shadow-[0_16px_36px_rgba(31,61,43,0.08)] backdrop-blur transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_30px_60px_rgba(31,61,43,0.16)] sm:rounded-[2rem] sm:p-6 sm:shadow-[0_22px_45px_rgba(31,61,43,0.08)]"
            delay={index * 140 + 80}
            key={item.title}
          >
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br ${item.accent} opacity-0 blur-2xl transition duration-500 group-hover:opacity-100`}
            />
            <div className="relative">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-forest-900/5 text-forest-700 transition duration-500 group-hover:-rotate-6 group-hover:scale-110 group-hover:bg-leaf-500/20 group-hover:text-forest-900 sm:h-14 sm:w-14">
                <HugeiconsIcon icon={item.icon} size={26} strokeWidth={1.5} />
              </span>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-beet-700 sm:mt-5">
                Bereich
              </p>
              <h3 className="mt-2 font-display text-2xl text-forest-900 sm:text-3xl">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-7 text-forest-700/80 sm:mt-3 sm:text-base">
                {item.text}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

export default WhatWeDo
