import { ArrowLeft01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import Footer from '~/components/landing/Footer'
import { formatGermanDate } from '~/lib/event-helpers'
import { fetchSharedEvent } from '~/services/event.service'
import type { SharedEvent } from '~func/contracts/event'

export const Route = createFileRoute('/termine/$slug/$token')({
  component: SharedEventPage,
})

/**
 * Public, no-auth read-only view of an event shared via a token.
 *
 * What shows:
 *   - Title, date/time, location.
 *   - Free-form agenda summary (the per-event `agenda` text).
 *   - Structured agenda items with their current status (open /
 *     besprochen / übersprungen).
 *
 * What does NOT show: attendees, votes, attachments, decisions,
 * tasks, any free-form meeting notes. The share view intentionally
 * stays abstract — folks in pre-meeting distribution don't see the
 * internal state yet.
 */
function SharedEventPage() {
  const { slug, token } = Route.useParams()
  const [shared, setShared] = useState<SharedEvent | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'gone'>('loading')

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    void fetchSharedEvent(token)
      .then((res) => {
        if (cancelled) return
        if (res === null) {
          setStatus('gone')
        } else {
          // Defensive: the admin-side may share a link from a different
          // event than the slug in the URL would suggest (the slug is
          // informational; the token is the secret). If they don't
          // match, refuse to render the wrong event.
          if (res.slug !== slug) {
            setStatus('gone')
            return
          }
          setShared(res)
          setStatus('ok')
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('gone')
      })
    return () => {
      cancelled = true
    }
  }, [slug, token])

  return (
    <div className="flex min-h-screen flex-col bg-[linear-gradient(180deg,#f8f3e7_0%,#f2ecdc_100%)] text-forest-900">
      <header className="mx-auto flex w-full max-w-[1180px] items-center gap-3 px-3 py-4 sm:px-6 lg:px-8">
        <Link
          aria-label="Zur Startseite"
          className="flex items-center gap-2 rounded-xl focus-visible:outline-2 focus-visible:outline-forest-700"
          to="/"
        >
          <img
            alt="Bewegung im Grünen"
            className="h-9 w-9 mix-blend-multiply"
            src="/brand/icon.png"
          />
        </Link>
        <span className="text-sm font-medium text-forest-700">
          Gartentermin
        </span>
        <Link
          aria-label="Zur Startseite"
          className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-sm font-medium text-forest-900 shadow-[0_8px_20px_rgba(31,61,43,0.08)] ring-1 ring-inset ring-white/40 backdrop-blur transition hover:bg-white focus-visible:outline-2 focus-visible:outline-forest-700"
          to="/"
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={ArrowLeft01Icon}
            size={16}
            strokeWidth={1.6}
          />
          Zur Startseite
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-3 pb-20 pt-6 sm:px-6 lg:px-8">
        {status === 'loading' && <LoadingPanel />}
        {status === 'gone' && <GonePanel />}
        {status === 'ok' && shared && <SharedEventPanel shared={shared} />}
      </main>
      <div className="mx-auto w-full max-w-[1180px] px-3 pb-6 sm:px-6 sm:pb-8 lg:px-8">
        <Footer />
      </div>
    </div>
  )
}

function LoadingPanel() {
  return (
    <div className="rounded-[1.5rem] bg-white/75 p-6 text-center text-forest-700/70 shadow-[0_8px_24px_rgba(31,61,43,0.07)] ring-1 ring-inset ring-white/40 backdrop-blur sm:p-8">
      Wird geladen …
    </div>
  )
}

function GonePanel() {
  return (
    <div
      className="rounded-[1.5rem] bg-white/75 p-6 text-center shadow-[0_8px_24px_rgba(31,61,43,0.07)] ring-1 ring-inset ring-white/40 backdrop-blur sm:p-8"
      data-testid="share-gone"
    >
      <p className="text-base font-semibold text-forest-900">
        Share-Link nicht mehr gültig
      </p>
      <p className="mt-2 text-sm text-forest-700/70">
        Der Link ist abgelaufen oder wurde aufgehoben. Wenn du glaubst, das ist
        ein Versehen, wende dich bitte an den Vorstand.
      </p>
    </div>
  )
}

function SharedEventPanel({ shared }: { shared: SharedEvent }) {
  return (
    <article
      className="space-y-6 rounded-[1.5rem] bg-white/75 p-6 shadow-[0_8px_24px_rgba(31,61,43,0.07)] ring-1 ring-inset ring-white/40 backdrop-blur sm:p-8"
      data-testid="share-event-panel"
    >
      <header className="space-y-2 border-b border-forest-900/10 pb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-forest-700/70">
          Gartentermin
          {shared.label ? ` · ${shared.label}` : ''}
        </p>
        <h1 className="font-display text-3xl text-forest-900 sm:text-4xl">
          {shared.title}
        </h1>
        <p className="text-sm text-forest-700/80">
          <strong>
            {formatGermanDate(shared.scheduled_date, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </strong>
          {shared.scheduled_time && ` · ${shared.scheduled_time} Uhr`}
          {shared.location && ` · ${shared.location}`}
        </p>
      </header>

      {shared.agenda?.trim() && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-forest-700/80">
            Vorbemerkung
          </h2>
          <p className="whitespace-pre-line text-sm text-forest-900">
            {shared.agenda}
          </p>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-forest-700/80">
          Tagesordnung
        </h2>
        {shared.agenda_items.length === 0 ? (
          <p className="text-sm text-forest-700/70">
            Es wurde noch keine Tagesordnung veröffentlicht.
          </p>
        ) : (
          <ol className="space-y-2">
            {shared.agenda_items.map((item, idx) => (
              <li
                className="flex items-start gap-3 rounded-[1rem] bg-white/70 p-3 ring-1 ring-inset ring-forest-900/8"
                // biome-ignore lint/suspicious/noArrayIndexKey: shared agenda items carry no id and titles can repeat; the list is render-only.
                key={idx}
              >
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest-900/8 text-xs font-semibold text-forest-700">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm font-medium text-forest-900">
                    {item.title}
                  </p>
                  <span
                    className={
                      'inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ' +
                      (item.status === 'discussed'
                        ? 'bg-leaf-500/15 text-leaf-500 ring-1 ring-inset ring-leaf-500/30'
                        : item.status === 'skipped'
                          ? 'bg-wood-600/15 text-wood-600 ring-1 ring-inset ring-wood-600/30'
                          : 'bg-forest-900/5 text-forest-700/70 ring-1 ring-inset ring-forest-900/10')
                    }
                  >
                    {statusLabel(item.status)}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  )
}

function statusLabel(status: string): string {
  switch (status) {
    case 'discussed':
      return 'Besprochen'
    case 'skipped':
      return 'Übersprungen'
    default:
      return 'Offen'
  }
}
