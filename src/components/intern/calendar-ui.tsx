import { cn } from '~/lib/ui-utils'
import type { SessionUser } from '~func/contracts/auth'

/**
 * Single source of truth for how the three calendar kinds look and
 * read: Vereinstermine in the brand leaf green, member entries in
 * forest, exclusive reservations in wood. `beet` stays reserved for
 * destructive actions.
 */

export type CalendarKind = 'termin' | 'event' | 'booking'

export const KIND_LABEL: Record<CalendarKind, string> = {
  termin: 'Vereinstermin',
  event: 'Termin',
  booking: 'Exklusive Reservierung',
}

/** Bar / chip styling per kind (background + ring + text). */
export const KIND_BAR: Record<CalendarKind, string> = {
  termin: 'bg-leaf-500/25 text-forest-900 ring-1 ring-inset ring-leaf-500/40',
  event:
    'bg-forest-700/12 text-forest-900 ring-1 ring-inset ring-forest-700/25',
  booking: 'bg-wood-600/15 text-forest-900 ring-1 ring-inset ring-wood-600/35',
}

export const KIND_DOT: Record<CalendarKind, string> = {
  termin: 'bg-leaf-500',
  event: 'bg-forest-700',
  booking: 'bg-wood-600',
}

export function EntryDot({
  kind,
  className,
}: {
  kind: CalendarKind
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'h-1.5 w-1.5 shrink-0 rounded-full',
        KIND_DOT[kind],
        className,
      )}
    />
  )
}

export function KindLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-forest-700/70">
      {(Object.keys(KIND_LABEL) as CalendarKind[]).map((kind) => (
        <span className="inline-flex items-center gap-1.5" key={kind}>
          <EntryDot kind={kind} />
          {KIND_LABEL[kind]}
        </span>
      ))}
    </div>
  )
}

/** Admins manage everything, members only their own entries. */
export function canManage(me: SessionUser, ownerId: number | null): boolean {
  if (me.role === 'admin') return true
  return me.user_id !== null && ownerId === me.user_id
}
