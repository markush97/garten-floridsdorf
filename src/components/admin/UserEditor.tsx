import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { DEFAULT_TIMEZONE, dayjs } from '~/lib/timezone'
import {
  useAdminUser,
  useCreateUser,
  useInviteUser,
  useUpdateUser,
} from '~/services/user.service'
import { Button } from '~/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/ui/dialog'
import { Input } from '~/ui/input'
import { Label } from '~/ui/label'
import { Separator } from '~/ui/separator'
import type { User } from '~func/contracts/user'
import { EditorShell, FIELD, TEXTAREA } from './form-ui'

type Props = { userSlug: string }

export default function UserEditor({ userSlug }: Props) {
  const isNew = userSlug === 'new'
  const navigate = useNavigate()
  const { mutate: createUser, isPending: isCreating } = useCreateUser()
  const { mutate: updateUser, isPending: isUpdating } = useUpdateUser(userSlug)

  if (isNew) {
    return (
      <NewUserForm
        isPending={isCreating}
        onSubmit={(data) =>
          createUser(data, {
            onSuccess: (user) => {
              toast.success('Benutzer angelegt.')
              void navigate({
                to: '/admin/users/$slug',
                params: { slug: user.slug },
              })
            },
            onError: () => toast.error('Fehler beim Anlegen des Benutzers.'),
          })
        }
      />
    )
  }

  return (
    <ExistingUserForm
      isPending={isUpdating}
      onSubmit={(data) =>
        updateUser(data, {
          onSuccess: () => toast.success('Änderungen gespeichert.'),
          onError: () => toast.error('Fehler beim Speichern.'),
        })
      }
      userSlug={userSlug}
    />
  )
}

type FormPayload = {
  first_name: string
  last_name: string
  email: string
  phone: string
  description: string
  role?: 'member' | 'admin'
}

type NewUserFormProps = {
  isPending: boolean
  onSubmit: (data: FormPayload) => void
}

function NewUserForm({ isPending, onSubmit }: NewUserFormProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [description, setDescription] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('Bitte Vor- und Nachname eingeben.')
      return
    }
    onSubmit({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      description: description.trim(),
    })
  }

  return (
    <EditorShell title="Neuen Benutzer anlegen">
      <form className="space-y-6" onSubmit={handleSubmit}>
        <UserFields
          description={description}
          email={email}
          firstName={firstName}
          lastName={lastName}
          phone={phone}
          setDescription={setDescription}
          setEmail={setEmail}
          setFirstName={setFirstName}
          setLastName={setLastName}
          setPhone={setPhone}
        />
        <Separator />
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link to="/admin/users">Abbrechen</Link>
          </Button>
          <Button disabled={isPending} type="submit">
            {isPending ? 'Wird angelegt …' : 'Benutzer anlegen'}
          </Button>
        </div>
      </form>
    </EditorShell>
  )
}

type ExistingUserFormProps = {
  isPending: boolean
  onSubmit: (data: FormPayload) => void
  userSlug: string
}

function ExistingUserForm({
  isPending,
  onSubmit,
  userSlug,
}: ExistingUserFormProps) {
  const { data: user, isPending: isLoading, isError } = useAdminUser(userSlug)

  if (isLoading) {
    return (
      <EditorShell title="Benutzer bearbeiten">
        <p className="text-forest-700/60">Wird geladen …</p>
      </EditorShell>
    )
  }

  if (isError || !user) {
    return (
      <EditorShell title="Benutzer bearbeiten">
        <p className="text-forest-700/60">Benutzer nicht gefunden.</p>
        <Link
          className="mt-4 inline-block text-sm underline text-forest-700"
          to="/admin/users"
        >
          Zurück zur Übersicht
        </Link>
      </EditorShell>
    )
  }

  return (
    <ExistingUserFormBody
      isPending={isPending}
      key={user.id}
      onSubmit={onSubmit}
      user={user}
    />
  )
}

type ExistingUserFormBodyProps = {
  user: User
  isPending: boolean
  onSubmit: (data: FormPayload) => void
}

function ExistingUserFormBody({
  user,
  isPending,
  onSubmit,
}: ExistingUserFormBodyProps) {
  const [firstName, setFirstName] = useState(user.first_name)
  const [lastName, setLastName] = useState(user.last_name)
  const [email, setEmail] = useState(user.email ?? '')
  const [phone, setPhone] = useState(user.phone ?? '')
  const [description, setDescription] = useState(user.description ?? '')
  const [role, setRole] = useState<'member' | 'admin'>(user.role)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('Bitte Vor- und Nachname eingeben.')
      return
    }
    onSubmit({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      description: description.trim(),
      role,
    })
  }

  return (
    <EditorShell title={`${user.first_name} ${user.last_name} bearbeiten`}>
      <form className="space-y-6" onSubmit={handleSubmit}>
        <UserFields
          description={description}
          email={email}
          firstName={firstName}
          lastName={lastName}
          phone={phone}
          setDescription={setDescription}
          setEmail={setEmail}
          setFirstName={setFirstName}
          setLastName={setLastName}
          setPhone={setPhone}
        />
        <Separator />
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-forest-900">Zugang</h2>
          <AccessStatus user={user} />
          <div className="space-y-1.5">
            <Label htmlFor="user-role">Rolle</Label>
            <select
              className={FIELD}
              id="user-role"
              onChange={(e) => setRole(e.target.value as 'member' | 'admin')}
              value={role}
            >
              <option value="member">Mitglied</option>
              <option value="admin">Admin</option>
            </select>
            <p className="text-xs text-forest-700/60">
              Admins verwalten Terminabstimmungen, Termine und Benutzer.
              Mitglieder sehen den internen Bereich mit den Dokumenten.
            </p>
          </div>
          <InviteSection user={user} />
        </div>
        <Separator />
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link to="/admin/users">Zurück</Link>
          </Button>
          <Button disabled={isPending} type="submit">
            {isPending ? 'Wird gespeichert …' : 'Änderungen speichern'}
          </Button>
        </div>
      </form>
    </EditorShell>
  )
}

function AccessStatus({ user }: { user: User }) {
  if (!user.activated_at) {
    return (
      <p className="text-sm text-forest-700/70">
        Noch kein Zugang — erstelle einen Einladungslink und schick ihn per
        WhatsApp oder E-Mail.
      </p>
    )
  }
  const since = dayjs
    .utc(user.activated_at)
    .tz(DEFAULT_TIMEZONE)
    .format('DD.MM.YYYY')
  return (
    <p className="text-sm text-forest-700/70">
      Aktiv seit {since} · Benutzername:{' '}
      <span className="font-medium text-forest-900">{user.username}</span>
    </p>
  )
}

function InviteSection({ user }: { user: User }) {
  const { mutate: inviteUser, isPending } = useInviteUser()
  const [invite, setInvite] = useState<{
    url: string
    expires_at: string
  } | null>(null)

  function handleInvite() {
    inviteUser(user.slug, {
      onSuccess: (data) => setInvite(data),
      onError: () =>
        toast.error('Einladungslink konnte nicht erstellt werden.'),
    })
  }

  const expiresAt = invite
    ? dayjs.utc(invite.expires_at).tz(DEFAULT_TIMEZONE).format('DD.MM.YYYY')
    : ''

  return (
    <>
      <Button
        disabled={isPending}
        onClick={handleInvite}
        type="button"
        variant="outline"
      >
        {isPending
          ? 'Wird erstellt …'
          : user.activated_at
            ? 'Neuen Einladungslink erstellen (Zugang zurücksetzen)'
            : 'Einladungslink erstellen'}
      </Button>
      <Dialog
        onOpenChange={(open) => !open && setInvite(null)}
        open={invite !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Einladungslink</DialogTitle>
            <DialogDescription>
              Der Link ist bis {expiresAt} gültig und wird nur einmal angezeigt.
              Beim Öffnen wählt {user.first_name} Benutzername und Passwort
              selbst.
            </DialogDescription>
          </DialogHeader>
          {invite && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                aria-label="Einladungslink"
                className="font-mono text-xs"
                onFocus={(e) => e.currentTarget.select()}
                readOnly
                value={invite.url}
              />
              <Button
                onClick={() => {
                  void navigator.clipboard
                    .writeText(invite.url)
                    .then(() => toast.success('Link kopiert.'))
                    .catch(() => toast.error('Kopieren fehlgeschlagen.'))
                }}
                type="button"
              >
                Kopieren
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setInvite(null)} variant="outline">
              Fertig
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

type UserFieldsProps = {
  firstName: string
  lastName: string
  email: string
  phone: string
  description: string
  setFirstName: (v: string) => void
  setLastName: (v: string) => void
  setEmail: (v: string) => void
  setPhone: (v: string) => void
  setDescription: (v: string) => void
}

function UserFields({
  firstName,
  lastName,
  email,
  phone,
  description,
  setFirstName,
  setLastName,
  setEmail,
  setPhone,
  setDescription,
}: UserFieldsProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="user-first-name">Vorname</Label>
          <Input
            className={FIELD}
            id="user-first-name"
            maxLength={100}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="z. B. Maria"
            required
            value={firstName}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="user-last-name">Nachname</Label>
          <Input
            className={FIELD}
            id="user-last-name"
            maxLength={100}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="z. B. Hinkel"
            required
            value={lastName}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="user-email">E-Mail (optional)</Label>
          <Input
            className={FIELD}
            id="user-email"
            maxLength={200}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="maria@example.com"
            type="email"
            value={email}
          />
          <p className="text-xs text-forest-700/60">
            Mit E-Mail-Adresse kann sich die Person auch per Anmeldelink
            einloggen.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="user-phone">Telefon (optional)</Label>
          <Input
            className={FIELD}
            id="user-phone"
            maxLength={200}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+43 660 …"
            type="tel"
            value={phone}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="user-description">Beschreibung (optional)</Label>
        <textarea
          className={TEXTAREA}
          id="user-description"
          maxLength={2000}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Allergien, Vorlieben, was sonst noch wichtig ist …"
          value={description}
        />
      </div>
    </div>
  )
}
