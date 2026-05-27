import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { DEFAULT_TIMEZONE, dayjs } from '~/lib/timezone'
import { cn } from '~/lib/ui-utils'
import {
  useAdminPolls,
  useDeletePoll,
  useFinalizePoll,
} from '~/services/admin.service'
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

function StatusBadge({
  isActive,
  finalOptionId,
}: {
  isActive: boolean
  finalOptionId: number | null
}) {
  if (finalOptionId) {
    return (
      <Badge className="bg-leaf-500/15 text-leaf-500 ring-leaf-500/30">
        Abgestimmt
      </Badge>
    )
  }
  if (isActive) {
    return (
      <Badge className="bg-leaf-500/15 text-leaf-500 ring-leaf-500/30">
        Aktiv
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-forest-700/60">
      Archiv
    </Badge>
  )
}

export default function AdminDashboard() {
  const { data: polls, isPending, isError } = useAdminPolls()
  const { mutate: deletePoll, isPending: isDeleting } = useDeletePoll()
  const { mutate: finalizePoll, isPending: isFinalizing } = useFinalizePoll()
  const [deleteId, setDeleteId] = useState<number | null>(null)

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
          <h1 className="text-2xl text-forest-900">Umfragen</h1>
          <Button asChild>
            <Link to="/admin/polls/$id" params={{ id: 'new' }}>
              Neue Umfrage
            </Link>
          </Button>
        </div>

        {polls?.length === 0 && (
          <p className="py-8 text-center text-sm text-forest-700/60">
            Noch keine Umfragen vorhanden.
          </p>
        )}

        <ul className="space-y-3">
          {polls?.map((poll) => (
            <li
              className="rounded-[1.25rem] bg-white/75 p-4 shadow-[0_4px_16px_rgba(31,61,43,0.06)] ring-1 ring-inset ring-white/40 backdrop-blur sm:p-5"
              key={poll.id}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      finalOptionId={poll.final_option_id}
                      isActive={poll.is_active}
                    />
                    <Link
                      className="font-medium text-forest-900 hover:text-forest-700 focus-visible:outline-2 focus-visible:outline-forest-700"
                      to="/poll/$id"
                      params={{ id: String(poll.id) }}
                    >
                      {poll.title}
                    </Link>
                  </div>
                  <p className="text-xs text-forest-700/60">
                    Erstellt{' '}
                    {dayjs(poll.created_at)
                      .tz(DEFAULT_TIMEZONE)
                      .format('D. MMM YYYY')}
                    {poll.closed_at &&
                      ` · Geschlossen ${dayjs(poll.closed_at).tz(DEFAULT_TIMEZONE).format('D. MMM YYYY')}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {poll.is_active && !poll.final_option_id && (
                    <Button
                      className="text-xs"
                      disabled={isFinalizing}
                      onClick={() =>
                        finalizePoll(
                          { id: poll.id, data: { closed: true } },
                          {
                            onSuccess: () =>
                              toast.success('Umfrage geschlossen.'),
                          },
                        )
                      }
                      size="sm"
                      variant="outline"
                    >
                      Schließen
                    </Button>
                  )}
                  <Button
                    asChild
                    className="text-xs"
                    size="sm"
                    variant="outline"
                  >
                    <Link
                      params={{ id: String(poll.id) }}
                      to="/admin/polls/$id"
                    >
                      Details
                    </Link>
                  </Button>
                  <Button
                    aria-label={`Umfrage "${poll.title}" löschen`}
                    className={cn(
                      'text-xs text-beet-700 hover:bg-beet-700/10 hover:text-beet-700',
                    )}
                    onClick={() => setDeleteId(poll.id)}
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
      </div>

      <Dialog
        onOpenChange={(open) => !open && setDeleteId(null)}
        open={deleteId !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Umfrage löschen?</DialogTitle>
            <DialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Alle Antworten
              werden ebenfalls gelöscht.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setDeleteId(null)} variant="outline">
              Abbrechen
            </Button>
            <Button
              className="bg-beet-700 text-white hover:bg-beet-700/90"
              disabled={isDeleting}
              onClick={() => {
                if (!deleteId) return
                deletePoll(deleteId, {
                  onSuccess: () => {
                    toast.success('Umfrage gelöscht.')
                    setDeleteId(null)
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

function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8f3e7_0%,#f2ecdc_100%)] text-forest-900">
      <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-4 px-3 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link to="/">
            <img
              alt="SV Beet & Bewegung"
              className="h-9 w-9"
              src="/brand/icon.png"
            />
          </Link>
          <span className="text-sm font-medium text-forest-700">Admin</span>
        </div>
        <Link className="text-xs text-forest-700/60 underline" to="/">
          Zur Startseite
        </Link>
      </header>
      <main className="mx-auto w-full max-w-[1180px] px-3 pb-20 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
