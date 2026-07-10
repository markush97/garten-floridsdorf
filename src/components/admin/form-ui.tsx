import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { cn } from '~/lib/ui-utils'
import { Button } from '~/ui/button'
import { Input } from '~/ui/input'
import { Label } from '~/ui/label'

/**
 * Shared chrome for the admin editors: the className constants for
 * plain form controls plus the small presentational widgets that were
 * previously copy-pasted across the panels (EditorShell,
 * ConfirmDeleteBar, PersonPicker). Everything in here is pure
 * presentation — no data fetching, no mutations.
 */

/** Standard single-line input styling for admin forms. */
export const FIELD =
  'w-full rounded-2xl border border-forest-900/12 bg-white/80 px-4 py-2.5 text-base text-forest-900 placeholder:text-forest-700/45 focus-visible:border-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30 focus-visible:outline-none'

/**
 * Standard textarea styling. The base height is `min-h-20`; use
 * `cn(TEXTAREA, 'min-h-24')` (etc.) where a taller field is wanted.
 */
export const TEXTAREA =
  'min-h-20 w-full rounded-2xl border border-forest-900/12 bg-white/80 px-4 py-3 text-base text-forest-900 placeholder:text-forest-700/45 focus-visible:border-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30 focus-visible:outline-none'

/**
 * Standard native `<select>` styling. Kept for standalone selects
 * that aren't paired with a text input (status/type/mode pickers).
 * For a select shown next to (or instead of) a text field, use
 * `SelectField` below instead — it strips the native chrome so both
 * controls read as the same kind of thing.
 */
export const SELECT =
  'h-11 w-full rounded-2xl border border-forest-900/12 bg-white/80 px-4 text-base text-forest-900 focus-visible:border-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30 focus-visible:outline-none'

/**
 * A `<select>` styled to match `FIELD`-styled text inputs exactly
 * (same box, padding, and focus ring) instead of the browser's native
 * dropdown chrome — `appearance-none` strips that, and a custom
 * chevron replaces the native arrow. Use this next to (or in place
 * of) an `Input` so both controls read as one design, not two.
 */
export function SelectField({
  className,
  ...props
}: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        className={cn(FIELD, 'appearance-none pr-10', className)}
        {...props}
      />
      <HugeiconsIcon
        aria-hidden="true"
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-forest-700/50"
        icon={ArrowDown01Icon}
        size={16}
        strokeWidth={1.8}
      />
    </div>
  )
}

/**
 * Formats free-typed digits into `HH:mm` as the user types. We use
 * this instead of `<input type="time">` because the native control
 * renders in the browser's OS locale (12h/AM-PM in en-US) regardless
 * of the page's `lang="de"` — this keeps the field German everywhere.
 */
export function formatTimeDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits
}

/**
 * Converts a `YYYY-MM-DD` string to a local `Date` for the
 * `DatePicker` (which works with `Date`, not ISO strings). Returns
 * `undefined` for empty/invalid input.
 */
export function parseIsoDate(iso: string): Date | undefined {
  const [y, m, d] = iso.split('-').map(Number)
  if (y === undefined || m === undefined || d === undefined) return undefined
  const date = new Date(y, m - 1, d)
  return Number.isNaN(date.getTime()) ? undefined : date
}

/** Converts a local `Date` back to the `YYYY-MM-DD` string the API expects. */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Full-page shell for the admin editors: brand header on top, one
 * centered content card with the page title. `titleAside` renders on
 * the right of the title row (e.g. a back link); `contentClassName`
 * can override the card width (default `max-w-3xl`).
 */
export function EditorShell({
  title,
  children,
  titleAside,
  contentClassName,
}: {
  title: string
  children: ReactNode
  titleAside?: ReactNode
  contentClassName?: string
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
        <div
          className={cn(
            'mx-auto max-w-3xl space-y-6 rounded-[1.5rem] bg-white/75 p-5 shadow-[0_8px_24px_rgba(31,61,43,0.07)] ring-1 ring-inset ring-white/40 backdrop-blur sm:p-8',
            contentClassName,
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl text-forest-900">{title}</h1>
            {titleAside}
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}

/**
 * Inline delete confirmation bar shown underneath a card after the
 * user hits "Löschen". Deliberately a plain container (not a dialog
 * role) — it is a visible, in-flow confirmation, not a modal.
 */
export function ConfirmDeleteBar({
  message,
  confirmLabel = 'Endgültig löschen',
  isPending = false,
  onConfirm,
  onCancel,
}: {
  message: string
  confirmLabel?: string
  isPending?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-beet-700/10 p-3 ring-1 ring-inset ring-beet-700/30">
      <p className="text-sm text-beet-700">{message}</p>
      <div className="flex gap-2">
        <Button onClick={onCancel} size="sm" type="button" variant="outline">
          Abbrechen
        </Button>
        <Button
          className="bg-beet-700 text-white hover:bg-beet-700/90"
          disabled={isPending}
          onClick={onConfirm}
          size="sm"
          type="button"
        >
          {isPending ? 'Wird gelöscht …' : confirmLabel}
        </Button>
      </div>
    </div>
  )
}

export type PersonPickerUser = {
  id: number
  first_name: string
  last_name: string
}

/**
 * Combined person picker: a user `<select>` plus a free-text fallback
 * for people without an account. The caller owns the state (and the
 * "clear the free text when a user is picked" rule). `idPrefix` must
 * be unique per form instance — use the entity id or 'new'.
 */
export function PersonPicker({
  label,
  idPrefix,
  users,
  userValue,
  freeTextValue,
  onUserChange,
  onFreeTextChange,
  freeTextPlaceholder = 'Name (kein Benutzer)',
}: {
  label: string
  idPrefix: string
  users: PersonPickerUser[]
  userValue: number | ''
  freeTextValue: string
  onUserChange: (v: number | '') => void
  onFreeTextChange: (v: string) => void
  freeTextPlaceholder?: string
}) {
  const selectId = `${idPrefix}-user`
  const freeTextId = `${idPrefix}-name`
  return (
    <div className="space-y-1.5">
      <Label htmlFor={selectId}>{label}</Label>
      <SelectField
        id={selectId}
        onChange={(e) =>
          onUserChange(e.target.value === '' ? '' : Number(e.target.value))
        }
        value={userValue}
      >
        <option value="">— kein Benutzer —</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.first_name} {u.last_name}
          </option>
        ))}
      </SelectField>
      <Label className="sr-only" htmlFor={freeTextId}>
        {label} — Name ohne Benutzerkonto
      </Label>
      <Input
        className={FIELD}
        id={freeTextId}
        maxLength={200}
        onChange={(e) => onFreeTextChange(e.target.value)}
        placeholder={freeTextPlaceholder}
        value={freeTextValue}
      />
    </div>
  )
}
