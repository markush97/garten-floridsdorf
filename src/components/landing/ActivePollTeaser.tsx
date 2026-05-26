import { CalendarIcon, SparklesIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { DEFAULT_TIMEZONE, dayjs } from '~/lib/timezone'
import Reveal from './Reveal'

function ActivePollTeaser() {
  const currentMonthLabel = dayjs().tz(DEFAULT_TIMEZONE).format('MMMM YYYY')

  return (
    <Reveal
      as="section"
      className="relative overflow-hidden rounded-[1.5rem] bg-forest-900 px-5 py-8 text-cream-50 shadow-[0_22px_50px_rgba(31,61,43,0.22)] sm:rounded-[2rem] sm:px-10 sm:py-12 sm:shadow-[0_28px_60px_rgba(31,61,43,0.22)]"
      id="aktuelle-umfrage"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(122,181,46,0.28),transparent_55%),radial-gradient(circle_at_10%_90%,rgba(122,31,61,0.35),transparent_55%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-12 top-10 h-40 w-40 animate-pulse-soft rounded-full bg-leaf-500/15 blur-3xl"
      />

      <div className="relative grid gap-6 sm:gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="space-y-4 sm:space-y-5">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-leaf-500 ring-1 ring-inset ring-leaf-500/30 backdrop-blur">
            <HugeiconsIcon icon={SparklesIcon} size={14} strokeWidth={2} />
            Aktuelle Umfrage
          </p>
          <h2 className="max-w-[16ch] text-3xl text-cream-50 sm:text-4xl lg:text-5xl">
            Aktuell keine offene Abstimmung.
          </h2>
          <p className="max-w-[60ch] text-base text-cream-50/85 sm:text-lg">
            Sobald ein Gartentermin zur Abstimmung steht, erscheint er hier.
            Schaut einfach wieder rein.
          </p>
        </div>

        <div className="rounded-[1.25rem] bg-white/10 p-4 text-sm text-cream-50/85 ring-1 ring-inset ring-white/15 backdrop-blur-md sm:w-[24rem] sm:rounded-[1.75rem] sm:p-5 sm:text-base">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-leaf-500/25 text-leaf-500">
              <HugeiconsIcon icon={CalendarIcon} size={22} strokeWidth={1.8} />
            </span>
            <p className="font-semibold text-cream-50">
              Stand {currentMonthLabel}
            </p>
          </div>
          <p className="mt-4">
            Der Admin kann jederzeit eine neue Umfrage anlegen. Alle
            Familienmitglieder können dann mit Name, Ja, Nein oder Vielleicht
            antworten.
          </p>
        </div>
      </div>
    </Reveal>
  )
}

export default ActivePollTeaser
