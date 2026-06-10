import {
  ArrowRight01Icon,
  Edit01Icon,
  Mail01Icon,
  SmartPhone01Icon,
  UserCircleIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '~/lib/ui-utils'
import { useAdminUsers, useDeleteUser } from '~/services/user.service'
import { Badge } from '~/ui/badge'
import { Button } from '~/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/ui/dialog'
import type { User } from '~func/contracts/user'
import AdminShell from './AdminShell'

function fullName(user: User) {
  return `${user.first_name} ${user.last_name}`.trim()
}

function AdminUsersList() {
  const { data: users, isPending, isError } = useAdminUsers()
  const { mutate: deleteUser, isPending: isDeleting } = useDeleteUser()
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null)

  if (isPending) {
    return (
      <AdminShell>
        <div className="py-16 text-center text-forest-700/60">
          Wird geladen …
        </div>
      </AdminShell>
    )
  }

  if (isError) {
    return (
      <AdminShell>
        <div className="py-16 text-center space-y-3">
          <p className="text-beet-700">
            Zugriff verweigert oder Fehler beim Laden.
          </p>
          <Link className="text-sm underline text-forest-700" to="/admin">
            Zur Anmeldung
          </Link>
        </div>
      </AdminShell>
    )
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl text-forest-900">Benutzer</h1>
            <p className="text-sm text-forest-700/70">
              Kontaktdaten der Leute, die im Garten mitmachen.
            </p>
          </div>
          <Button asChild>
            <Link to="/admin/users/$slug" params={{ slug: 'new' }}>
              Neuer Benutzer
            </Link>
          </Button>
        </div>

        {users?.length === 0 ? (
          <p className="py-8 text-center text-sm text-forest-700/60">
            Noch keine Benutzer angelegt.
          </p>
        ) : (
          <ul className="space-y-3">
            {users?.map((user) => (
              <li
                className="rounded-[1.25rem] bg-white/75 p-4 shadow-[0_4px_16px_rgba(31,61,43,0.06)] ring-1 ring-inset ring-white/40 backdrop-blur sm:p-5"
                key={user.id}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest-900/5 text-forest-700">
                      <HugeiconsIcon
                        aria-hidden="true"
                        icon={UserCircleIcon}
                        size={22}
                        strokeWidth={1.6}
                      />
                    </span>
                    <div className="space-y-1">
                      <Link
                        className="font-medium text-forest-900 hover:text-forest-700 focus-visible:outline-2 focus-visible:outline-forest-700"
                        to="/admin/users/$slug"
                        params={{ slug: user.slug }}
                      >
                        {fullName(user)}
                      </Link>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-forest-700/70">
                        {user.email && (
                          <span className="inline-flex items-center gap-1.5">
                            <HugeiconsIcon
                              aria-hidden="true"
                              icon={Mail01Icon}
                              size={12}
                              strokeWidth={1.6}
                            />
                            <a
                              className="underline-offset-2 hover:underline"
                              href={`mailto:${user.email}`}
                            >
                              {user.email}
                            </a>
                          </span>
                        )}
                        {user.phone && (
                          <span className="inline-flex items-center gap-1.5">
                            <HugeiconsIcon
                              aria-hidden="true"
                              icon={SmartPhone01Icon}
                              size={12}
                              strokeWidth={1.6}
                            />
                            <a
                              className="underline-offset-2 hover:underline"
                              href={`tel:${user.phone.replace(/\s+/g, '')}`}
                            >
                              {user.phone}
                            </a>
                          </span>
                        )}
                        {!user.email && !user.phone && (
                          <span className="text-forest-700/50">
                            Keine Kontaktdaten
                          </span>
                        )}
                      </div>
                      {user.description && (
                        <p className="line-clamp-2 text-sm text-forest-700/80">
                          {user.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      asChild
                      className="text-xs"
                      size="sm"
                      variant="outline"
                    >
                      <Link
                        params={{ slug: user.slug }}
                        to="/admin/users/$slug"
                      >
                        <HugeiconsIcon
                          aria-hidden="true"
                          icon={Edit01Icon}
                          size={14}
                          strokeWidth={1.6}
                        />
                        Bearbeiten
                      </Link>
                    </Button>
                    <Button
                      aria-label={`Benutzer "${fullName(user)}" löschen`}
                      className={cn(
                        'text-xs text-beet-700 hover:bg-beet-700/10 hover:text-beet-700',
                      )}
                      onClick={() => setDeleteSlug(user.slug)}
                      size="sm"
                      variant="outline"
                    >
                      Löschen
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-[1.25rem] bg-white/60 p-5 ring-1 ring-inset ring-white/40 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-leaf-500/15 text-leaf-500">
              <HugeiconsIcon
                aria-hidden="true"
                icon={ArrowRight01Icon}
                size={18}
                strokeWidth={1.8}
              />
            </span>
            <div className="space-y-1 text-sm text-forest-700/80">
              <p className="font-semibold text-forest-900">
                Nächster Schritt: Anwesenheitslisten
              </p>
              <p>
                Sobald ein Termin feststeht, kannst du hier pro Benutzer
                markieren, wer kommt, wer absagt und wer noch unsicher ist.
              </p>
            </div>
          </div>
          <div className="mt-3">
            <Badge
              className="bg-wood-600/15 text-wood-600 ring-1 ring-inset ring-wood-600/30"
              variant="outline"
            >
              Bald verfügbar
            </Badge>
          </div>
        </div>
      </div>

      <Dialog
        onOpenChange={(open) => !open && setDeleteSlug(null)}
        open={deleteSlug !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Benutzer löschen?</DialogTitle>
            <DialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden.
              {deleteSlug && (
                <>
                  {' '}
                  <span className="font-semibold text-forest-900">
                    {users?.find((u) => u.slug === deleteSlug)?.first_name}{' '}
                    {users?.find((u) => u.slug === deleteSlug)?.last_name}
                  </span>{' '}
                  wird aus der Benutzerliste entfernt.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setDeleteSlug(null)} variant="outline">
              Abbrechen
            </Button>
            <Button
              className="bg-beet-700 text-white hover:bg-beet-700/90"
              disabled={isDeleting}
              onClick={() => {
                if (!deleteSlug) return
                deleteUser(deleteSlug, {
                  onSuccess: () => {
                    toast.success('Benutzer gelöscht.')
                    setDeleteSlug(null)
                  },
                  onError: () => toast.error('Fehler beim Löschen.'),
                })
              }}
            >
              {isDeleting ? 'Wird gelöscht …' : 'Endgültig löschen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  )
}

export default AdminUsersList
