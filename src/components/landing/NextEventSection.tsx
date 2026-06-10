import { CalendarCheckIn01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { DEFAULT_TIMEZONE, dayjs } from '~/lib/timezone'
import { useNextEvent } from '~/services/poll.service'
import Reveal from './Reveal'

function formatEventDate(date: string) {
  const d = dayjs(date).tz(DEFAULT_TIMEZONE)
  return {
    headline: d.format('dddd, D. MMMM YYYY'),
    short: d.format('D. MMM YYYY'),
    isoWeekday: d.format('dd'),
  }
}

function NextEventSection() {
  const { data: event, isPending, isError } = useNextEvent()

  if (isPending || isError || !event) {
    return null
  }

  const { headline, short, isoWeekday } = formatEventDate(event.option.date)
  const optionDate = dayjs(event.option.date).tz(DEFAULT_TIMEZONE)
  const today = dayjs().tz(DEFAULT_TIMEZONE).startOf('day')
  const isToday = optionDate.isSame(today, 'day')
  const isPast = optionDate.isBefore(today, 'day')
  const daysAway = optionDate.diff(today, 'day')

  return (
    <Reveal
      as="section"
      className="relative overflow-hidden rounded-[1.5rem] bg-cream-50 p-5 text-forest-900 shadow-[0_18px_40px_rgba(31,61,43,0.08)] ring-1 ring-inset ring-white/40 backdrop-blur sm:rounded-[2rem] sm:p-8 sm:shadow-[0_24px_50px_rgba(31,61,43,0.1)]"
      id="naechster-termin"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(122,181,46,0.18),transparent_55%),radial-gradient(circle_at_90%_85%,rgba(122,31,61,0.12),transparent_55%)]"
      />
      <div className="relative grid gap-5 sm:gap-6 lg:grid-cols-[auto_1fr] lg:items-center">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-3xl bg-forest-900 text-cream-50 shadow-[0_12px_24px_rgba(31,61,43,0.25)] sm:h-24 sm:w-24"
          >
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-leaf-500">
              {isoWeekday}
            </span>
            <span className="font-display text-3xl leading-none sm:text-4xl">
              {optionDate.format('D')}
            </span>
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-cream-50/70">
              {optionDate.format('MMM')}
            </span>
          </div>
          <div className="space-y-1.5 sm:hidden">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-forest-700">
              Nächster Termin
            </p>
            <p className="font-display text-2xl text-forest-900">{headline}</p>
          </div>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <p className="hidden text-xs font-semibold uppercase tracking-[0.24em] text-forest-700 sm:block">
            Nächster Termin
          </p>
          <h2 className="hidden font-display text-3xl text-forest-900 sm:block sm:text-4xl lg:text-5xl">
            {headline}
          </h2>
          <p className="text-base text-forest-700/80 sm:text-lg">
            <span className="font-semibold text-forest-900">{event.title}</span>
            {event.option.time && (
              <>
                {' '}
                um{' '}
                <span className="font-semibold text-forest-900">
                  {event.option.time} Uhr
                </span>
              </>
            )}
            {event.option.label && (
              <>
                {' '}
                · <span className="italic">{event.option.label}</span>
              </>
            )}
            .
          </p>
          <p className="inline-flex items-center gap-2 rounded-full bg-leaf-500/15 px-3 py-1 text-xs font-semibold text-leaf-500 ring-1 ring-inset ring-leaf-500/30">
            <HugeiconsIcon
              aria-hidden="true"
              icon={CalendarCheckIn01Icon}
              size={14}
              strokeWidth={1.8}
            />
            {isToday
              ? 'Heute geht’s los!'
              : isPast
                ? `War vor ${Math.abs(daysAway)} ${Math.abs(daysAway) === 1 ? 'Tag' : 'Tagen'}`
                : `Noch ${daysAway} ${daysAway === 1 ? 'Tag' : 'Tage'} bis zum Treffen`}
          </p>
          <p className="text-sm text-forest-700/70">
            Wir sehen uns am <span className="font-semibold">{short}</span> im
            Garten.
          </p>
        </div>
      </div>
    </Reveal>
  )
}

export default NextEventSection
