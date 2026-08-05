import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { useAcceptInvite, useInvitePreview } from '~/services/auth.service'
import { Button } from '~/ui/button'
import { Input } from '~/ui/input'
import { Label } from '~/ui/label'
import { targetAfterLogin } from './LoginPage'

type Props = { token: string }

export default function InvitePage({ token }: Props) {
  const navigate = useNavigate()
  const { data: preview, isPending, isError, error } = useInvitePreview(token)
  const { mutate: acceptInvite, isPending: isAccepting } =
    useAcceptInvite(token)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordRepeat, setPasswordRepeat] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== passwordRepeat) {
      toast.error('Die Passwörter stimmen nicht überein.')
      return
    }
    acceptInvite(
      { username: username.trim().toLowerCase(), password },
      {
        onSuccess: (me) => {
          toast.success('Willkommen! Dein Zugang ist eingerichtet.')
          void navigate({ to: targetAfterLogin(me) })
        },
        onError: (err) =>
          toast.error(
            (err as { message?: string }).message ??
              'Einrichtung fehlgeschlagen.',
          ),
      },
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f8f3e7_0%,#f2ecdc_100%)] px-4">
      <div className="w-full max-w-sm space-y-6 rounded-[1.5rem] bg-white/75 p-8 shadow-[0_22px_45px_rgba(31,61,43,0.08)] ring-1 ring-inset ring-white/40 backdrop-blur">
        <div className="space-y-1 text-center">
          <img
            alt="Bewegung im Grünen"
            className="mx-auto h-14 w-14 mix-blend-multiply"
            src="/brand/icon.png"
          />
          {isPending ? (
            <p className="text-sm text-forest-700/70">Wird geladen …</p>
          ) : isError || !preview ? (
            <>
              <h1 className="text-2xl text-forest-900">Link ungültig</h1>
              <p className="text-sm text-forest-700/70">
                {(error as { message?: string } | null)?.message ??
                  'Diese Einladung ist abgelaufen oder wurde bereits verwendet.'}{' '}
                Bitte frag beim Vorstand nach einer neuen Einladung.
              </p>
              <p className="pt-2 text-xs">
                <Link className="text-forest-700 underline" to="/login">
                  Zur Anmeldung
                </Link>
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl text-forest-900">
                Hallo {preview.first_name}!
              </h1>
              <p className="text-sm text-forest-700/70">
                Richte deinen Zugang ein: Benutzername wählen, Passwort setzen —
                fertig.
              </p>
            </>
          )}
        </div>

        {preview && !isError && (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="invite-username">Benutzername</Label>
              <Input
                autoCapitalize="none"
                autoComplete="username"
                autoCorrect="off"
                id="invite-username"
                maxLength={30}
                minLength={3}
                onChange={(e) => setUsername(e.target.value)}
                pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]{1,28}[a-zA-Z0-9]"
                placeholder="z. B. maria.h"
                required
                title="3–30 Zeichen: Buchstaben, Ziffern, Punkt, Unterstrich, Bindestrich"
                value={username}
              />
              <p className="text-xs text-forest-700/60">
                3–30 Zeichen, Kleinbuchstaben, Ziffern und ._-
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-password">Passwort</Label>
              <Input
                autoComplete="new-password"
                id="invite-password"
                minLength={8}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mindestens 8 Zeichen"
                required
                type="password"
                value={password}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-password-repeat">
                Passwort wiederholen
              </Label>
              <Input
                autoComplete="new-password"
                id="invite-password-repeat"
                minLength={8}
                onChange={(e) => setPasswordRepeat(e.target.value)}
                placeholder="••••••••"
                required
                type="password"
                value={passwordRepeat}
              />
            </div>
            <Button
              className="min-h-12 w-full"
              disabled={isAccepting}
              type="submit"
            >
              {isAccepting ? 'Wird eingerichtet …' : 'Zugang einrichten'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
