import { ArrowLeft01Icon, Download01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import Footer from '~/components/landing/Footer'
import { fileIcon, formatFileSize } from '~/lib/file-helpers'
import { fetchSharedDocumentTarget } from '~/services/document.service'
import type { SharedDocumentTarget } from '~func/contracts/document'

export const Route = createFileRoute('/dokumente/$token')({
  component: SharedDocumentPage,
})

/**
 * Public, no-auth view of a document- or folder-share link. A
 * document token shows one file with a download button; a folder
 * token shows every file nested under that folder (flattened, with
 * its relative path) — mirrors the event share page's shape.
 */
function SharedDocumentPage() {
  const { token } = Route.useParams()
  const [target, setTarget] = useState<SharedDocumentTarget | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'gone'>('loading')

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    void fetchSharedDocumentTarget(token)
      .then((res) => {
        if (cancelled) return
        if (res === null) {
          setStatus('gone')
        } else {
          setTarget(res)
          setStatus('ok')
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('gone')
      })
    return () => {
      cancelled = true
    }
  }, [token])

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
        <span className="text-sm font-medium text-forest-700">Dokumente</span>
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
        {status === 'ok' && target && (
          <SharedTargetPanel target={target} token={token} />
        )}
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
    <div className="rounded-[1.5rem] bg-white/75 p-6 text-center shadow-[0_8px_24px_rgba(31,61,43,0.07)] ring-1 ring-inset ring-white/40 backdrop-blur sm:p-8">
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

function SharedTargetPanel({
  target,
  token,
}: {
  target: SharedDocumentTarget
  token: string
}) {
  if (target.type === 'document') {
    const doc = target.document
    return (
      <article className="space-y-4 rounded-[1.5rem] bg-white/75 p-6 shadow-[0_8px_24px_rgba(31,61,43,0.07)] ring-1 ring-inset ring-white/40 backdrop-blur sm:p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-forest-900/5 text-forest-700">
            <HugeiconsIcon
              aria-hidden="true"
              icon={fileIcon(doc.content_type)}
              size={26}
              strokeWidth={1.6}
            />
          </span>
          <div className="min-w-0 space-y-1">
            <h1 className="font-display text-2xl text-forest-900 sm:text-3xl">
              {doc.title}
            </h1>
            <p className="text-sm text-forest-700/70">
              {doc.filename} · {formatFileSize(doc.size)}
            </p>
          </div>
        </div>
        <a
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-leaf-500 px-6 text-sm font-semibold text-white transition-colors hover:bg-leaf-500/90 focus-visible:outline-2 focus-visible:outline-leaf-500"
          href={`/api/share/documents/${token}/download/${doc.id}`}
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={Download01Icon}
            size={16}
            strokeWidth={1.8}
          />
          Herunterladen
        </a>
      </article>
    )
  }

  return (
    <article className="space-y-5 rounded-[1.5rem] bg-white/75 p-6 shadow-[0_8px_24px_rgba(31,61,43,0.07)] ring-1 ring-inset ring-white/40 backdrop-blur sm:p-8">
      <header className="space-y-1 border-b border-forest-900/10 pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-forest-700/70">
          Geteilter Ordner
        </p>
        <h1 className="font-display text-2xl text-forest-900 sm:text-3xl">
          {target.folder_name}
        </h1>
      </header>
      {target.documents.length === 0 ? (
        <p className="text-sm text-forest-700/70">
          Dieser Ordner enthält noch keine Dateien.
        </p>
      ) : (
        <ul className="space-y-2">
          {target.documents.map((doc) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3 rounded-[1rem] bg-white/70 p-3 ring-1 ring-inset ring-forest-900/8"
              key={doc.id}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-forest-900/5 text-forest-700">
                  <HugeiconsIcon
                    aria-hidden="true"
                    icon={fileIcon(doc.content_type)}
                    size={18}
                    strokeWidth={1.6}
                  />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-forest-900">
                    {doc.title}
                  </p>
                  <p className="truncate text-xs text-forest-700/60">
                    {doc.path && `${doc.path} · `}
                    {formatFileSize(doc.size)}
                  </p>
                </div>
              </div>
              <a
                className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-semibold text-forest-900 ring-1 ring-inset ring-forest-900/12 transition hover:bg-forest-900/5"
                href={`/api/share/documents/${token}/download/${doc.id}`}
              >
                <HugeiconsIcon
                  aria-hidden="true"
                  icon={Download01Icon}
                  size={14}
                  strokeWidth={1.8}
                />
                Herunterladen
              </a>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
