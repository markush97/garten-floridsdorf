import { CalendarIcon, SparklesIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { DEFAULT_TIMEZONE, dayjs } from '~/lib/timezone'
import { useActivePoll } from '~/services/poll.service'
import Reveal from './Reveal'

function ActivePollTeaser() {
  const { data: poll, isPending } = useActivePoll()
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

      <picture>
        <source srcSet="/images/season-autumn.avif" type="image/avif" />
        <source srcSet="/images/season-autumn.webp" type="image/webp" />
        <img
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full object-cover opacity-40 mix-blend-screen mask-[linear-gradient(to_top,black,transparent)] sm:h-32 lg:h-40"
          loading="lazy"
          src="/images/season-autumn.webp"
        />
      </picture>

      <div className="relative grid gap-6 sm:gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="space-y-4 sm:space-y-5">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-leaf-500 ring-1 ring-inset ring-leaf-500/30 backdrop-blur">
            <HugeiconsIcon icon={SparklesIcon} size={14} strokeWidth={2} />
            Aktuelle Umfrage
          </p>

          {isPending ? (
            <h2 className="max-w-[16ch] text-3xl text-cream-50 sm:text-4xl lg:text-5xl">
              Wird geladen …
            </h2>
          ) : poll ? (
            <>
              <h2 className="max-w-[16ch] text-3xl text-cream-50 sm:text-4xl lg:text-5xl">
                {poll.title}
              </h2>
              {poll.description && (
                <p className="line-clamp-2 max-w-[60ch] text-base text-cream-50/85 sm:text-lg">
                  {poll.description
                    .replace(/<[^>]*>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()}
                </p>
              )}
              <Link
                className="inline-flex min-h-12 items-center rounded-full bg-leaf-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-leaf-500/90 focus-visible:outline-2 focus-visible:outline-leaf-500"
                to="/abstimmung/$slug"
                params={{ slug: poll.slug }}
              >
                Jetzt abstimmen
              </Link>
            </>
          ) : (
            <>
              <h2 className="max-w-[16ch] text-3xl text-cream-50 sm:text-4xl lg:text-5xl">
                Aktuell keine offene Abstimmung.
              </h2>
              <p className="max-w-[60ch] text-base text-cream-50/85 sm:text-lg">
                Sobald ein Gartentermin zur Abstimmung steht, erscheint er hier.
                Schaut einfach wieder rein.
              </p>
            </>
          )}
        </div>

        {!poll && (
          <div className="rounded-[1.25rem] bg-white/10 p-4 text-sm text-cream-50/85 ring-1 ring-inset ring-white/15 backdrop-blur-md sm:w-[24rem] sm:rounded-[1.75rem] sm:p-5 sm:text-base">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-leaf-500/25 text-leaf-500">
                <HugeiconsIcon
                  icon={CalendarIcon}
                  size={22}
                  strokeWidth={1.8}
                />
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
        )}
      </div>
    </Reveal>
  )
}

export default ActivePollTeaser
