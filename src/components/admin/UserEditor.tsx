import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  useAdminUser,
  useCreateUser,
  useUpdateUser,
} from '~/services/user.service'
import { Button } from '~/ui/button'
import { Input } from '~/ui/input'
import { Label } from '~/ui/label'
import { Separator } from '~/ui/separator'

type Props = { userSlug: string }

const FIELD =
  'w-full rounded-2xl border border-forest-900/12 bg-white/80 px-4 py-2.5 text-base text-forest-900 placeholder:text-forest-700/45 focus-visible:border-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30 focus-visible:outline-none'

const TEXTAREA =
  'min-h-32 w-full rounded-2xl border border-forest-900/12 bg-white/80 px-4 py-3 text-base text-forest-900 placeholder:text-forest-700/45 focus-visible:border-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30 focus-visible:outline-none'

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
      onCancel={() => navigate({ to: '/admin/users' })}
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
  onCancel: () => void
  onSubmit: (data: FormPayload) => void
  userSlug: string
}

function ExistingUserForm({
  isPending,
  onCancel,
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
      initial={{
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email ?? '',
        phone: user.phone ?? '',
        description: user.description ?? '',
      }}
      isPending={isPending}
      onCancel={onCancel}
      onSubmit={onSubmit}
      title={`${user.first_name} ${user.last_name}`}
    />
  )
}

type ExistingUserFormBodyProps = {
  initial: {
    firstName: string
    lastName: string
    email: string
    phone: string
    description: string
  }
  isPending: boolean
  onCancel: () => void
  onSubmit: (data: FormPayload) => void
  title: string
}

function ExistingUserFormBody({
  initial,
  isPending,
  onCancel,
  onSubmit,
  title,
}: ExistingUserFormBodyProps) {
  const [firstName, setFirstName] = useState(initial.firstName)
  const [lastName, setLastName] = useState(initial.lastName)
  const [email, setEmail] = useState(initial.email)
  const [phone, setPhone] = useState(initial.phone)
  const [description, setDescription] = useState(initial.description)

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
    <EditorShell title={`${title} bearbeiten`}>
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
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link to="/admin/users">Zurück</Link>
          </Button>
          <Button onClick={onCancel} type="button" variant="outline">
            Verwerfen
          </Button>
          <Button disabled={isPending} type="submit">
            {isPending ? 'Wird gespeichert …' : 'Änderungen speichern'}
          </Button>
        </div>
      </form>
    </EditorShell>
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

function EditorShell({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8f3e7_0%,#f2ecdc_100%)] text-forest-900">
      <header className="mx-auto flex w-full max-w-[1180px] items-center gap-3 px-3 py-4 sm:px-6 lg:px-8">
        <Link to="/">
          <img
            alt="SV Beet & Bewegung"
            className="h-9 w-9 mix-blend-multiply"
            src="/brand/icon.png"
          />
        </Link>
        <span className="text-sm font-medium text-forest-700">Admin</span>
      </header>
      <main className="mx-auto w-full max-w-[1180px] px-3 pb-20 pt-2 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl space-y-6 rounded-[1.5rem] bg-white/75 p-5 shadow-[0_8px_24px_rgba(31,61,43,0.07)] ring-1 ring-inset ring-white/40 backdrop-blur sm:p-8">
          <h1 className="text-2xl text-forest-900">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  )
}
