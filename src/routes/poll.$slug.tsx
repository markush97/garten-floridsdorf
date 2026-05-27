import { createFileRoute, Link } from '@tanstack/react-router'
import Footer from '~/components/landing/Footer'
import PollView from '~/components/poll/PollView'
import VoteForm from '~/components/poll/VoteForm'
import { usePoll } from '~/services/poll.service'

export const Route = createFileRoute('/poll/$slug')({
  component: PollPage,
})

function PollPage() {
  const { slug } = Route.useParams()
  const { data: poll, isPending, isError } = usePoll(slug)

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8f3e7_0%,#f2ecdc_100%)] text-forest-900">
      <header className="mx-auto flex w-full max-w-[1180px] items-center gap-3 px-3 py-4 sm:px-6 lg:px-8">
        <Link
          aria-label="Zur Startseite"
          className="flex items-center gap-2 rounded-xl focus-visible:outline-2 focus-visible:outline-forest-700"
          to="/"
        >
          <img
            alt="SV Beet & Bewegung"
            className="h-9 w-9 rounded-full bg-cream-50 p-1"
            src="/brand/icon.png"
          />
        </Link>
        <span className="text-sm font-medium text-forest-700">
          Gartentermin-Abstimmung
        </span>
      </header>

      <main className="mx-auto w-full max-w-[1180px] px-3 pb-20 sm:px-6 lg:px-8">
        {isPending && (
          <div className="py-16 text-center text-forest-700/60">
            Wird geladen …
          </div>
        )}
        {isError && (
          <div className="py-16 text-center text-beet-700">
            Umfrage konnte nicht geladen werden.{' '}
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
                  className="prose-content mt-2 text-base text-forest-700/80 sm:text-lg"
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
                  Diese Umfrage ist abgeschlossen.
                </p>
              )}
            </div>

            <PollView poll={poll} />

            {poll.is_active && !poll.final_option_id && (
              <VoteForm poll={poll} />
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
