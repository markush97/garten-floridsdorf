import { useState } from 'react'
import { toast } from 'sonner'
import { formatTimeDigits, IsoDateField } from '~/components/admin/form-ui'
import { DEFAULT_TIMEZONE, dayjs } from '~/lib/timezone'
import {
  useCalendarMembers,
  useCancelBooking,
  useCreateBooking,
  useCreateCalendarEvent,
  useUpdateBooking,
  useUpdateCalendarEvent,
} from '~/services/calendar.service'
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
import { BOOKING_MIN_LEAD_DAYS, earliestBookableDate } from '~func/_lib/booking'
import type { SessionUser } from '~func/contracts/auth'
import type {
  CalendarBookingEntry,
  CalendarEventEntry,
} from '~func/contracts/calendar'
import { canManage } from './calendar-ui'
import { FIELD, SELECT, TEXTAREA } from './task-ui'

// ── Member calendar event ────────────────────────────────────────────────────

export function CalendarEventDialog({
  open,
  onOpenChange,
  editing,
  defaultDate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: CalendarEventEntry | null
  defaultDate: string
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <CalendarEventForm
          defaultDate={defaultDate}
          editing={editing}
          key={editing?.id ?? `new-${defaultDate}`}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function CalendarEventForm({
  editing,
  defaultDate,
  onDone,
}: {
  editing: CalendarEventEntry | null
  defaultDate: string
  onDone: () => void
}) {
  const { mutateAsync: createEvent, isPending: isCreating } =
    useCreateCalendarEvent()
  const { mutateAsync: updateEvent, isPending: isUpdating } =
    useUpdateCalendarEvent()

  const [title, setTitle] = useState(editing?.title ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [location, setLocation] = useState(editing?.location ?? '')
  const [startDate, setStartDate] = useState(editing?.start_date ?? defaultDate)
  const [endDate, setEndDate] = useState(editing?.end_date ?? '')
  const [startTime, setStartTime] = useState(editing?.start_time ?? '')
  const [endTime, setEndTime] = useState(editing?.end_time ?? '')

  const isPending = isCreating || isUpdating

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Bitte einen Titel eingeben.')
      return
    }
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      start_date: startDate,
      end_date: endDate || null,
      start_time: startTime || null,
      end_time: endTime || null,
    }
    try {
      if (editing) {
        await updateEvent({ id: editing.id, data: payload })
        toast.success('Eintrag aktualisiert.')
      } else {
        await createEvent(payload)
        toast.success('Eintrag angelegt.')
      }
      onDone()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Speichern fehlgeschlagen.',
      )
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>
          {editing ? 'Eintrag bearbeiten' : 'Neuer Kalendereintrag'}
        </DialogTitle>
        <DialogDescription>
          Ein persönlicher Eintrag im gemeinsamen Kalender – z. B. ein
          Arbeitseinsatz oder ein Treffen.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="cal-title">Titel</Label>
        <Input
          className={FIELD}
          id="cal-title"
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="z. B. Gemeinsamer Arbeitseinsatz"
          required
          value={title}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cal-desc">Beschreibung</Label>
        <textarea
          className={TEXTAREA}
          id="cal-desc"
          maxLength={5000}
          onChange={(e) => setDescription(e.target.value)}
          value={description}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cal-location">Ort</Label>
        <Input
          className={FIELD}
          id="cal-location"
          maxLength={500}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="optional"
          value={location}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Von</Label>
          <IsoDateField onChange={setStartDate} required value={startDate} />
        </div>
        <div className="space-y-1.5">
          <Label>Bis (optional)</Label>
          <IsoDateField
            onChange={setEndDate}
            placeholder="Kein Datum"
            value={endDate}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cal-start-time">Beginn (optional)</Label>
          <Input
            className={FIELD}
            id="cal-start-time"
            inputMode="numeric"
            maxLength={5}
            onChange={(e) => setStartTime(formatTimeDigits(e.target.value))}
            placeholder="HH:mm"
            value={startTime}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cal-end-time">Ende (optional)</Label>
          <Input
            className={FIELD}
            id="cal-end-time"
            inputMode="numeric"
            maxLength={5}
            onChange={(e) => setEndTime(formatTimeDigits(e.target.value))}
            placeholder="HH:mm"
            value={endTime}
          />
        </div>
      </div>

      <DialogFooter>
        <Button
          disabled={isPending}
          onClick={onDone}
          type="button"
          variant="outline"
        >
          Abbrechen
        </Button>
        <Button disabled={isPending} type="submit">
          {isPending ? 'Wird gespeichert …' : editing ? 'Speichern' : 'Anlegen'}
        </Button>
      </DialogFooter>
    </form>
  )
}

// ── Exclusive reservation (booking) ──────────────────────────────────────────

export function BookingDialog({
  open,
  onOpenChange,
  editing,
  defaultDate,
  me,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: CalendarBookingEntry | null
  defaultDate: string
  me: SessionUser
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <BookingForm
          defaultDate={defaultDate}
          editing={editing}
          key={editing?.id ?? `new-${defaultDate}`}
          me={me}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function BookingForm({
  editing,
  defaultDate,
  me,
  onDone,
}: {
  editing: CalendarBookingEntry | null
  defaultDate: string
  me: SessionUser
  onDone: () => void
}) {
  const { mutateAsync: createBooking, isPending: isCreating } =
    useCreateBooking()
  const { mutateAsync: updateBooking, isPending: isUpdating } =
    useUpdateBooking()
  const { mutateAsync: cancelBooking, isPending: isCancelling } =
    useCancelBooking()

  // Admins may reserve in someone else's name, hand a reservation over
  // to another member, and are not bound by the Statuten lead time.
  const isAdmin = me.role === 'admin'
  // Members can only start `BOOKING_MIN_LEAD_DAYS` out, so offer the
  // earliest allowed day instead of running them into the rule on
  // submit.
  const earliest = earliestBookableDate(new Date().toISOString())
  const firstDate = isAdmin || defaultDate >= earliest ? defaultDate : earliest

  const [startDate, setStartDate] = useState(editing?.start_date ?? firstDate)
  const [startTime, setStartTime] = useState(editing?.start_time ?? '14:00')
  const [endDate, setEndDate] = useState(editing?.end_date ?? firstDate)
  // Defaults to a same-day reservation — an overnight stay is optional,
  // for one just move the end date forward.
  const [endTime, setEndTime] = useState(editing?.end_time ?? '18:00')
  const [note, setNote] = useState(editing?.note ?? '')
  const tooSoon = !isAdmin && startDate < earliest
  const { data: members = [] } = useCalendarMembers(isAdmin)
  // Defaults to the current owner when editing, to me when creating.
  const [forUserId, setForUserId] = useState(
    editing?.user_id != null
      ? String(editing.user_id)
      : me.user_id != null && !editing
        ? String(me.user_id)
        : '',
  )
  // Owner and creator may cancel; a member only before it has started
  // (the server enforces the same rule).
  const canCancel =
    editing !== null && (isAdmin || canManage(me, editing.user_id))

  const isPending = isCreating || isUpdating || isCancelling

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const bookFor = isAdmin && forUserId ? Number(forUserId) : null
    const payload = {
      start_date: startDate,
      start_time: startTime,
      end_date: endDate,
      end_time: endTime,
      note: note.trim() || null,
      for_user_id: bookFor,
    }
    try {
      if (editing) {
        await updateBooking({ id: editing.id, data: payload })
        toast.success('Reservierung aktualisiert.')
      } else {
        await createBooking(payload)
        toast.success('Reservierung angelegt.')
      }
      onDone()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Speichern fehlgeschlagen.',
      )
    }
  }

  async function handleCancel() {
    if (!editing) return
    if (!confirm('Diese Reservierung stornieren?')) return
    try {
      await cancelBooking(editing.id)
      toast.success('Reservierung storniert.')
      onDone()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Stornieren fehlgeschlagen.',
      )
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>
          {editing ? 'Reservierung bearbeiten' : 'Exklusive Reservierung'}
        </DialogTitle>
        <DialogDescription>
          Reserviert die Anlage exklusiv – mit oder ohne Übernachtung. Es gelten
          die Statuten-Regeln für Vorlauf und Abrechnung.
        </DialogDescription>
      </DialogHeader>

      {isAdmin ? (
        <div className="space-y-1.5">
          <Label htmlFor="bk-for">Reservieren für</Label>
          <select
            className={SELECT}
            id="bk-for"
            onChange={(e) => setForUserId(e.target.value)}
            value={forUserId}
          >
            <option value="">Mich selbst</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-forest-700/60">
            {editing
              ? `Derzeit auf ${editing.user_name}. Als Admin kannst du die Reservierung einem anderen Mitglied zuordnen.`
              : 'Als Admin kannst du die Anlage auch im Namen eines anderen Mitglieds reservieren.'}
          </p>
        </div>
      ) : (
        editing && (
          <p className="text-sm text-forest-700/70">
            Reservierung von {editing.user_name}.
          </p>
        )
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Beginn</Label>
          <IsoDateField onChange={setStartDate} required value={startDate} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bk-start-time">Uhrzeit</Label>
          <Input
            className={FIELD}
            id="bk-start-time"
            inputMode="numeric"
            maxLength={5}
            onChange={(e) => setStartTime(formatTimeDigits(e.target.value))}
            placeholder="HH:mm"
            required
            value={startTime}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Ende</Label>
          <IsoDateField onChange={setEndDate} required value={endDate} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bk-end-time">Uhrzeit</Label>
          <Input
            className={FIELD}
            id="bk-end-time"
            inputMode="numeric"
            maxLength={5}
            onChange={(e) => setEndTime(formatTimeDigits(e.target.value))}
            placeholder="HH:mm"
            required
            value={endTime}
          />
        </div>
      </div>

      <p className="text-xs text-forest-700/60">
        {isAdmin
          ? `Mitglieder müssen mindestens ${BOOKING_MIN_LEAD_DAYS} Tage im Voraus reservieren – als Admin darfst du auch kurzfristig oder rückwirkend eintragen.`
          : `Reservierungen müssen mindestens ${BOOKING_MIN_LEAD_DAYS} Tage im Voraus erfolgen.`}
      </p>
      {tooSoon && (
        <p className="text-xs text-beet-700">
          Frühester möglicher Beginn:{' '}
          {dayjs(earliest).tz(DEFAULT_TIMEZONE).format('DD.MM.YYYY')}.
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="bk-note">Notiz (optional)</Label>
        <Input
          className={FIELD}
          id="bk-note"
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
          value={note}
        />
      </div>

      <DialogFooter className="sm:justify-between">
        {canCancel ? (
          <Button
            className="text-beet-700 sm:mr-auto"
            disabled={isPending}
            onClick={handleCancel}
            type="button"
            variant="ghost"
          >
            {isCancelling ? 'Wird storniert …' : 'Reservierung stornieren'}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button
            disabled={isPending}
            onClick={onDone}
            type="button"
            variant="outline"
          >
            Abbrechen
          </Button>
          <Button disabled={isPending} type="submit">
            {isPending
              ? 'Wird gespeichert …'
              : editing
                ? 'Speichern'
                : 'Anlegen'}
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}
