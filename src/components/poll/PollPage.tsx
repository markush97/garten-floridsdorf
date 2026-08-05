import { ArrowLeft01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import Footer from '~/components/landing/Footer'
import PollView from '~/components/poll/PollView'
import VoteForm from '~/components/poll/VoteForm'
import { usePoll } from '~/services/poll.service'

type Props = {
  slug: string
  token?: string
}

export default function PollPage({ slug, token }: Props) {
  const { data: poll, isPending, error } = usePoll(slug, token)
  const status = (error as { status?: number } | null)?.status

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
          Gartentermin-Abstimmung
        </span>
        <Link
          className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-sm font-medium text-forest-900 shadow-[0_8px_20px_rgba(31,61,43,0.08)] ring-1 ring-inset ring-white/40 backdrop-blur transition hover:bg-white focus-visible:outline-2 focus-visible:outline-forest-700"
          to="/"
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={ArrowLeft01Icon}
            size={16}
            strokeWidth={2}
          />
          <span>Zur Startseite</span>
        </Link>
      </header>

      <main className="mx-auto w-full max-w-[1180px] flex-1 px-3 pb-20 sm:px-6 lg:px-8">
        {isPending && (
          <div className="py-16 text-center text-forest-700/60">
            Wird geladen …
          </div>
        )}
        {!isPending && status === 401 && <LoginGate />}
        {!isPending && status === 410 && <ExpiredGate />}
        {!isPending && error && status !== 401 && status !== 410 && (
          <div className="py-16 text-center text-beet-700">
            Terminabstimmung konnte nicht geladen werden.{' '}
            <Link className="underline" to="/">
              Zurück zur Startseite
            </Link>
          </div>
        )}
        {poll && (
          <div className="space-y-8 pt-6">
            <div>
              <h1 className="text-3xl sm:text-4xl">{poll.title}</h1>
              {poll.description && (
                <div
                  className="prose-content mt-4 border-l-4 border-leaf-500/40 pl-4 text-base text-forest-700/80 sm:mt-5 sm:pl-5 sm:text-lg"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: admin-generated WYSIWYG HTML
                  dangerouslySetInnerHTML={{ __html: poll.description }}
                />
              )}
              {poll.final_option_id && (
                <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-leaf-500/15 px-4 py-1.5 text-sm font-semibold text-leaf-500">
                  ✓ Termin steht fest
                </p>
              )}
              {!poll.is_active && !poll.final_option_id && (
                <p className="mt-3 text-sm text-forest-700/60">
                  Diese Terminabstimmung ist abgeschlossen.
                </p>
              )}
            </div>

            <PollView poll={poll} />

            {poll.is_active && !poll.final_option_id && (
              <VoteForm poll={poll} token={token} />
            )}
          </div>
        )}
      </main>

      <div className="mx-auto w-full max-w-[1180px] px-3 pb-6 sm:px-6 sm:pb-8 lg:px-8">
        <Footer />
      </div>
    </div>
  )
}

function LoginGate() {
  return (
    <div className="mx-auto mt-6 max-w-md rounded-[1.5rem] bg-white/75 p-6 text-center shadow-[0_8px_24px_rgba(31,61,43,0.07)] ring-1 ring-inset ring-white/40 backdrop-blur sm:p-8">
      <p className="text-base font-semibold text-forest-900">
        Nur für Mitglieder oder mit Einladungslink
      </p>
      <p className="mt-2 text-sm text-forest-700/70">
        Diese Terminabstimmung ist nur für angemeldete Mitglieder oder mit einem
        persönlichen Einladungslink sichtbar.
      </p>
      <Link
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-forest-900 px-6 py-2.5 text-sm font-semibold text-cream-50 transition hover:bg-forest-900/90"
        to="/login"
      >
        Zum Mitglieder-Login
      </Link>
    </div>
  )
}

function ExpiredGate() {
  return (
    <div className="mx-auto mt-6 max-w-md rounded-[1.5rem] bg-white/75 p-6 text-center shadow-[0_8px_24px_rgba(31,61,43,0.07)] ring-1 ring-inset ring-white/40 backdrop-blur sm:p-8">
      <p className="text-base font-semibold text-forest-900">
        Einladungslink nicht mehr gültig
      </p>
      <p className="mt-2 text-sm text-forest-700/70">
        Der Link ist abgelaufen oder wurde aufgehoben. Wenn du glaubst, das ist
        ein Versehen, wende dich bitte an den Vorstand.
      </p>
      <Link className="mt-5 inline-block text-sm underline" to="/">
        Zurück zur Startseite
      </Link>
    </div>
  )
}
