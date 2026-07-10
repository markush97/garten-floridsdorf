import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '~/lib/ui-utils'
import {
  useCreateShareToken,
  useRevokeShareToken,
  useShareTokens,
} from '~/services/event.service'
import { Button } from '~/ui/button'
import { Separator } from '~/ui/separator'

type Props = {
  event: { slug: string; title: string }
}

/**
 * Admin-side share-link management. Lives on the event workspace
 * and gives the admin three actions:
 *
 *   1. Create a new share link (optionally with a label) and reveal
 *      the plaintext token exactly once.
 *   2. Copy an existing token's share URL to the clipboard.
 *   3. Revoke an active link. A revoked link still appears in the
 *      list (so the admin can see who got the link) but the public
 *      endpoint returns 410.
 */
export default function SharePanel({ event }: Props) {
  const { data: tokens } = useShareTokens(event.slug)
  const { mutate: createToken, isPending: isCreating } = useCreateShareToken(
    event.slug,
  )
  const { mutate: revokeToken, isPending: isRevoking } = useRevokeShareToken(
    event.slug,
  )

  const [label, setLabel] = useState('')
  const [revealedToken, setRevealedToken] = useState<{
    plaintext: string
    label: string | null
  } | null>(null)

  function origin() {
    if (typeof window === 'undefined') return ''
    return window.location.origin
  }

  function fullShareUrl(plaintext: string): string {
    return `${origin()}/termine/${event.slug}/${plaintext}`
  }

  return (
    <div className="space-y-5">
      <NewTokenForm
        isCreating={isCreating}
        label={label}
        onLabelChange={setLabel}
        onSubmit={() =>
          createToken(
            { label: label.trim() ? label.trim() : null },
            {
              onSuccess: (res) => {
                setRevealedToken({
                  plaintext: res.plaintext,
                  label: res.token.label,
                })
                setLabel('')
                toast.success('Share-Link erstellt.')
              },
              onError: () => toast.error('Erstellen fehlgeschlagen.'),
            },
          )
        }
      />

      {revealedToken && (
        <RevealBox
          label={revealedToken.label}
          plaintext={revealedToken.plaintext}
          url={fullShareUrl(revealedToken.plaintext)}
          onDismiss={() => setRevealedToken(null)}
        />
      )}

      {tokens && tokens.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-sm font-semibold text-forest-900">
              Aktive Links
            </p>
            <ul className="space-y-2">
              {tokens.map((t) => (
                <li
                  className="flex flex-col gap-1 rounded-[1rem] bg-white/65 p-3 ring-1 ring-inset ring-forest-900/8 sm:flex-row sm:items-center sm:justify-between"
                  data-testid={`share-token-${t.id}`}
                  key={t.id}
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded bg-forest-900/5 px-1.5 py-0.5 font-mono text-xs text-forest-900">
                        {t.token_fingerprint}…
                      </code>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                          t.is_active
                            ? 'bg-leaf-500/15 text-leaf-500 ring-1 ring-inset ring-leaf-500/30'
                            : 'bg-wood-600/15 text-wood-600 ring-1 ring-inset ring-wood-600/30',
                        )}
                      >
                        {t.is_active ? 'Aktiv' : 'Aufgehoben'}
                      </span>
                      {t.label && (
                        <span className="text-xs text-forest-700/80">
                          {t.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-forest-700/60">
                      Erstellt am {t.created_at}
                      {t.last_hit_at && ` · zuletzt geöffnet ${t.last_hit_at}`}
                      {t.expires_at && ` · läuft ${t.expires_at} ab`}
                    </p>
                  </div>
                  {t.is_active && (
                    <Button
                      aria-label="Share-Link aufheben"
                      className="text-xs text-beet-700 hover:bg-beet-700/10 hover:text-beet-700"
                      disabled={isRevoking}
                      onClick={() =>
                        revokeToken(t.id, {
                          onSuccess: () =>
                            toast.success('Share-Link aufgehoben.'),
                          onError: () =>
                            toast.error('Aufheben fehlgeschlagen.'),
                        })
                      }
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Aufheben
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

const FIELD =
  'w-full rounded-2xl border border-forest-900/12 bg-white/80 px-4 py-2.5 text-base text-forest-900 placeholder:text-forest-700/45 focus-visible:border-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30 focus-visible:outline-none'

function NewTokenForm({
  label,
  onLabelChange,
  onSubmit,
  isCreating,
}: {
  label: string
  onLabelChange: (v: string) => void
  onSubmit: () => void
  isCreating: boolean
}) {
  return (
    <div className="space-y-2 rounded-[1.25rem] bg-forest-900/4 p-4 ring-1 ring-inset ring-forest-900/8">
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-forest-700">
          Label (optional, z. B. „Vorstand" oder „Newsletter")
        </span>
        <input
          className={FIELD}
          maxLength={200}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder="Wofür ist dieser Link?"
          value={label}
        />
      </label>
      <div className="flex justify-end">
        <Button
          className={cn(isCreating && 'opacity-60')}
          disabled={isCreating}
          onClick={onSubmit}
          size="sm"
          type="button"
        >
          {isCreating ? 'Wird erstellt …' : 'Share-Link erzeugen'}
        </Button>
      </div>
    </div>
  )
}

function RevealBox({
  url,
  plaintext,
  label,
  onDismiss,
}: {
  url: string
  plaintext: string
  label: string | null
  onDismiss: () => void
}) {
  return (
    <aside
      aria-label="Neuer Share-Link — bitte sicher kopieren"
      className="space-y-3 rounded-[1.25rem] bg-leaf-500/8 p-4 ring-1 ring-inset ring-leaf-500/30"
      role="alert"
    >
      <p className="text-sm font-semibold text-forest-900">
        Neuer Share-Link{label ? ` (${label})` : ''}
      </p>
      <p className="text-xs text-forest-700/80">
        Der Link wird genau einmal angezeigt. Bitte jetzt kopieren und im
        gewünschten Kanal teilen.
      </p>
      <div className="space-y-2">
        <div className="flex items-stretch gap-2">
          <input
            aria-label="Vollständiger Share-Link"
            className={cn(FIELD, 'flex-1 font-mono text-xs')}
            data-testid="share-token-plaintext"
            onFocus={(e) => e.currentTarget.select()}
            readOnly
            value={url}
          />
          <Button
            onClick={() => {
              if (typeof navigator !== 'undefined' && navigator.clipboard) {
                navigator.clipboard
                  .writeText(url)
                  .then(() => toast.success('In Zwischenablage kopiert.'))
                  .catch(() => toast.error('Kopieren fehlgeschlagen.'))
              }
            }}
            size="sm"
            type="button"
          >
            Kopieren
          </Button>
        </div>
        <p className="font-mono text-[10px] text-forest-700/60">
          Token: {plaintext}
        </p>
      </div>
      <div className="flex justify-end">
        <Button
          className="text-xs"
          onClick={onDismiss}
          size="sm"
          type="button"
          variant="ghost"
        >
          Verstanden, schließen
        </Button>
      </div>
    </aside>
  )
}
