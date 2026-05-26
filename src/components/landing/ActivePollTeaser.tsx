import { DEFAULT_TIMEZONE, dayjs } from '~/lib/timezone'

function ActivePollTeaser() {
  const currentMonthLabel = dayjs().tz(DEFAULT_TIMEZONE).format('MMMM YYYY')

  return (
    <section
      className="overflow-hidden rounded-[2rem] bg-forest-900 px-6 py-8 text-cream-50 shadow-[0_28px_60px_rgba(31,61,43,0.22)] sm:px-8 sm:py-10"
      id="aktuelle-umfrage"
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-leaf-500">
            Aktuelle Umfrage
          </p>
          <h2 className="max-w-[16ch] text-4xl text-cream-50 sm:text-5xl">
            Aktuell keine offene Abstimmung.
          </h2>
          <p className="max-w-[60ch] text-base text-cream-50/80 sm:text-lg">
            Sobald ein Gartentermin zur Abstimmung steht, erscheint er hier.
            Schaut einfach wieder rein.
          </p>
        </div>

        <div className="rounded-[1.5rem] bg-white/10 p-5 text-sm text-cream-50/80 backdrop-blur sm:w-[24rem] sm:text-base">
          <p className="font-semibold text-cream-50">
            Stand {currentMonthLabel}
          </p>
          <p className="mt-3">
            Der Admin kann jederzeit eine neue Umfrage anlegen. Alle
            Familienmitglieder können dann mit Name, Ja, Nein oder Vielleicht
            antworten.
          </p>
        </div>
      </div>
    </section>
  )
}

export default ActivePollTeaser
