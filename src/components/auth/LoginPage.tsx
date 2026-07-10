import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useLogin, useRequestMagicLink } from '~/services/auth.service'
import { Button } from '~/ui/button'
import { Input } from '~/ui/input'
import { Label } from '~/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/ui/tabs'
import type { SessionUser } from '~func/contracts/auth'

type Props = {
  /** Set via `/login?magic=invalid` when a magic link was rejected. */
  magicError?: boolean
}

export function targetAfterLogin(me: SessionUser): '/admin/polls' | '/intern' {
  return me.role === 'admin' ? '/admin/polls' : '/intern'
}

export default function LoginPage({ magicError }: Props) {
  const navigate = useNavigate()
  const { mutate: login, isPending: isLoggingIn } = useLogin()
  const { mutate: requestMagicLink, isPending: isRequesting } =
    useRequestMagicLink()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [magicSent, setMagicSent] = useState(false)

  useEffect(() => {
    if (magicError) {
      toast.error('Der Anmeldelink ist ungültig oder abgelaufen.')
    }
  }, [magicError])

  function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    login(
      { username: username.trim().toLowerCase(), password },
      {
        onSuccess: (me) => {
          void navigate({ to: targetAfterLogin(me) })
        },
        onError: (err) => {
          toast.error(
            (err as { message?: string }).message ??
              'Anmeldung fehlgeschlagen.',
          )
          setPassword('')
        },
      },
    )
  }

  function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    requestMagicLink(email.trim(), {
      onSuccess: () => setMagicSent(true),
      onError: (err) =>
        toast.error(
          (err as { message?: string }).message ??
            'Anfrage fehlgeschlagen. Bitte später erneut versuchen.',
        ),
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f8f3e7_0%,#f2ecdc_100%)] px-4">
      <div className="w-full max-w-sm space-y-6 rounded-[1.5rem] bg-white/75 p-8 shadow-[0_22px_45px_rgba(31,61,43,0.08)] ring-1 ring-inset ring-white/40 backdrop-blur">
        <div className="space-y-1 text-center">
          <Link to="/">
            <img
              alt="SV Beet & Bewegung"
              className="mx-auto h-14 w-14 mix-blend-multiply"
              src="/brand/icon.png"
            />
          </Link>
          <h1 className="text-2xl text-forest-900">Anmelden</h1>
          <p className="text-sm text-forest-700/70">
            Zugang nur mit Einladung — frag im Zweifel beim Vorstand nach.
          </p>
        </div>

        <Tabs defaultValue="password">
          <TabsList className="w-full">
            <TabsTrigger className="flex-1" value="password">
              Passwort
            </TabsTrigger>
            <TabsTrigger className="flex-1" value="magic">
              E-Mail-Link
            </TabsTrigger>
          </TabsList>

          <TabsContent value="password">
            <form className="space-y-4 pt-2" onSubmit={handlePasswordLogin}>
              <div className="space-y-1.5">
                <Label htmlFor="login-username">Benutzername</Label>
                <Input
                  autoCapitalize="none"
                  autoComplete="username"
                  autoCorrect="off"
                  id="login-username"
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="benutzername"
                  required
                  value={username}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password">Passwort</Label>
                <Input
                  autoComplete="current-password"
                  id="login-password"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  type="password"
                  value={password}
                />
              </div>
              <Button
                className="min-h-12 w-full"
                disabled={isLoggingIn}
                type="submit"
              >
                {isLoggingIn ? 'Anmelden …' : 'Anmelden'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="magic">
            {magicSent ? (
              <div className="space-y-3 pt-2 text-center">
                <p className="text-sm text-forest-900">
                  Wenn die Adresse zu einem Konto gehört, ist ein Anmeldelink
                  unterwegs. Schau in dein Postfach!
                </p>
                <button
                  className="text-xs text-forest-700 underline"
                  onClick={() => setMagicSent(false)}
                  type="button"
                >
                  Andere Adresse verwenden
                </button>
              </div>
            ) : (
              <form className="space-y-4 pt-2" onSubmit={handleMagicLink}>
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">E-Mail-Adresse</Label>
                  <Input
                    autoComplete="email"
                    id="login-email"
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="maria@example.com"
                    required
                    type="email"
                    value={email}
                  />
                </div>
                <p className="text-xs text-forest-700/70">
                  Wir schicken dir einen Link, mit dem du dich ohne Passwort
                  anmeldest.
                </p>
                <Button
                  className="min-h-12 w-full"
                  disabled={isRequesting}
                  type="submit"
                >
                  {isRequesting ? 'Wird gesendet …' : 'Link senden'}
                </Button>
              </form>
            )}
          </TabsContent>
        </Tabs>

        <p className="text-center text-xs text-forest-700/60">
          <Link className="underline" to="/">
            Zur Startseite
          </Link>
        </p>
      </div>
    </div>
  )
}
