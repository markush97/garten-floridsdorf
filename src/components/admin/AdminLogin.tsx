import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { useAdminLogin } from '~/services/admin.service'
import { Button } from '~/ui/button'
import { Input } from '~/ui/input'
import { Label } from '~/ui/label'

export default function AdminLogin() {
  const [password, setPassword] = useState('')
  const navigate = useNavigate()
  const { mutate: login, isPending } = useAdminLogin()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    login(password, {
      onSuccess: () => {
        void navigate({ to: '/admin/polls' })
      },
      onError: (err) => {
        const msg =
          (err as { message?: string }).message ?? 'Anmeldung fehlgeschlagen.'
        toast.error(msg)
        setPassword('')
      },
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f8f3e7_0%,#f2ecdc_100%)] px-4">
      <div className="w-full max-w-sm space-y-6 rounded-[1.5rem] bg-white/75 p-8 shadow-[0_22px_45px_rgba(31,61,43,0.08)] ring-1 ring-inset ring-white/40 backdrop-blur">
        <div className="space-y-1 text-center">
          <img
            alt="SV Beet & Bewegung"
            className="mx-auto h-14 w-14 mix-blend-multiply"
            src="/brand/icon.png"
          />
          <h1 className="text-2xl text-forest-900">Admin-Bereich</h1>
          <p className="text-sm text-forest-700/70">Bitte Passwort eingeben</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="admin-password">Passwort</Label>
            <Input
              autoComplete="current-password"
              id="admin-password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              type="password"
              value={password}
            />
          </div>
          <Button
            className="min-h-12 w-full"
            disabled={isPending}
            type="submit"
          >
            {isPending ? 'Anmelden …' : 'Anmelden'}
          </Button>
        </form>
      </div>
    </div>
  )
}
