import {
  Calendar01Icon,
  Copy01Icon,
  Delete02Icon,
  Edit02Icon,
  PlusSignIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Navigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  type CalendarSegment,
  segmentsOnDay,
  toSegments,
} from '~/lib/calendar-grid'
import { DEFAULT_TIMEZONE, dayjs } from '~/lib/timezone'
import { useMe } from '~/services/auth.service'
import {
  useCalendarMonth,
  useCalendarToken,
  useCancelBooking,
  useCreateCalendarToken,
  useDeleteCalendarEvent,
  useDeleteCalendarToken,
} from '~/services/calendar.service'
import { useMyProfile, useUpdateMyProfile } from '~/services/profile.service'
import { Button } from '~/ui/button'
import type { SessionUser } from '~func/contracts/auth'
import { BookingDialog, CalendarEventDialog } from './CalendarEntryDialogs'
import CalendarMonthGrid from './CalendarMonthGrid'
import { canManage, KIND_LABEL, KindLegend } from './calendar-ui'
import MemberShell from './MemberShell'

export default function KalenderPage() {
  const { data: me, isPending, isError } = useMe()

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f8f3e7_0%,#f2ecdc_100%)] text-sm text-forest-700/60">
        Wird geladen …
      </div>
    )
  }
  if (isError || !me) {
    return <Navigate to="/login" />
  }
  return (
    <MemberShell me={me}>
      <KalenderContent me={me} />
    </MemberShell>
  )
}

function KalenderContent({ me }: { me: SessionUser }) {
  const todayIso = dayjs().tz(DEFAULT_TIMEZONE).format('YYYY-MM-DD')
  const [monat, setMonat] = useState(() => todayIso.slice(0, 7))
  const [selectedDay, setSelectedDay] = useState<string | null>(todayIso)

  const { data, isPending } = useCalendarMonth(monat)
  const segments = useMemo(() => toSegments(data?.entries ?? []), [data])
  const daySegments = selectedDay ? segmentsOnDay(segments, selectedDay) : []

  const [eventEditing, setEventEditing] = useState<Extract<
    CalendarSegment['entry'],
    { kind: 'event' }
  > | null>(null)
  const [eventOpen, setEventOpen] = useState(false)
  const [bookingEditing, setBookingEditing] = useState<Extract<
    CalendarSegment['entry'],
    { kind: 'booking' }
  > | null>(null)
  const [bookingOpen, setBookingOpen] = useState(false)

  const defaultDate = selectedDay ?? todayIso

  function navigate(target: -1 | 1 | 'today') {
    if (target === 'today') {
      setMonat(todayIso.slice(0, 7))
      setSelectedDay(todayIso)
      return
    }
    setMonat(dayjs.utc(`${monat}-01`).add(target, 'month').format('YYYY-MM'))
  }

  function onSegmentClick(segment: CalendarSegment) {
    setSelectedDay(segment.startDay)
    if (segment.entry.kind === 'event') {
      setEventEditing(segment.entry)
      setEventOpen(true)
    } else if (segment.entry.kind === 'booking') {
      setBookingEditing(segment.entry)
      setBookingOpen(true)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl text-forest-900">Kalender</h1>
          <p className="text-sm text-forest-700/70">
            Vereinstermine, eigene Einträge und exklusive Reservierungen auf
            einen Blick.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setEventEditing(null)
              setEventOpen(true)
            }}
            variant="outline"
          >
            <HugeiconsIcon
              aria-hidden="true"
              icon={PlusSignIcon}
              size={16}
              strokeWidth={1.6}
            />
            Eintrag
          </Button>
          <Button
            onClick={() => {
              setBookingEditing(null)
              setBookingOpen(true)
            }}
          >
            <HugeiconsIcon
              aria-hidden="true"
              icon={PlusSignIcon}
              size={16}
              strokeWidth={1.6}
            />
            Reservierung
          </Button>
        </div>
      </div>

      <CalendarMonthGrid
        isLoading={isPending}
        monat={monat}
        onNavigate={navigate}
        onSegmentClick={onSegmentClick}
        onSelectDay={setSelectedDay}
        segments={segments}
        selectedDay={selectedDay}
        todayIso={todayIso}
      />

      <KindLegend />

      {selectedDay && (
        <DayPanel
          date={selectedDay}
          me={me}
          onEditBooking={(entry) => {
            setBookingEditing(entry)
            setBookingOpen(true)
          }}
          onEditEvent={(entry) => {
            setEventEditing(entry)
            setEventOpen(true)
          }}
          segments={daySegments}
        />
      )}

      <SubscribePanel />

      <CalendarEventDialog
        defaultDate={defaultDate}
        editing={eventEditing}
        onOpenChange={setEventOpen}
        open={eventOpen}
      />
      <BookingDialog
        defaultDate={defaultDate}
        editing={bookingEditing}
        onOpenChange={setBookingOpen}
        open={bookingOpen}
      />
    </div>
  )
}

function DayPanel({
  date,
  segments,
  me,
  onEditEvent,
  onEditBooking,
}: {
  date: string
  segments: CalendarSegment[]
  me: SessionUser
  onEditEvent: (
    entry: Extract<CalendarSegment['entry'], { kind: 'event' }>,
  ) => void
  onEditBooking: (
    entry: Extract<CalendarSegment['entry'], { kind: 'booking' }>,
  ) => void
}) {
  const { mutate: deleteEvent } = useDeleteCalendarEvent()
  const { mutate: cancelBooking } = useCancelBooking()

  return (
    <section className="rounded-[1.25rem] bg-white/75 p-4 shadow-[0_4px_16px_rgba(31,61,43,0.06)] ring-1 ring-inset ring-white/40 backdrop-blur sm:p-5">
      <h2 className="mb-3 font-display text-lg text-forest-900">
        {dayjs.utc(date).format('dddd, D. MMMM YYYY')}
      </h2>
      {segments.length === 0 ? (
        <p className="text-sm text-forest-700/60">
          Keine Einträge an diesem Tag.
        </p>
      ) : (
        <ul className="space-y-2">
          {segments.map((segment) => {
            const { entry } = segment
            const owner =
              entry.kind === 'event'
                ? entry.created_by_user_id
                : entry.kind === 'booking'
                  ? entry.user_id
                  : null
            const editable = entry.kind !== 'termin' && canManage(me, owner)
            return (
              <li
                className="flex items-center justify-between gap-2 rounded-2xl bg-cream-50/60 px-3 py-2"
                key={segment.key}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-forest-900">
                    {segment.title}
                  </p>
                  <p className="text-xs text-forest-700/60">
                    {KIND_LABEL[segment.kind]}
                    {segment.timeLabel && ` · ${segment.timeLabel}`}
                  </p>
                </div>
                {editable && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      aria-label="Bearbeiten"
                      onClick={() =>
                        entry.kind === 'event'
                          ? onEditEvent(entry)
                          : onEditBooking(entry)
                      }
                      size="icon-sm"
                      variant="ghost"
                    >
                      <HugeiconsIcon
                        aria-hidden="true"
                        icon={Edit02Icon}
                        size={16}
                        strokeWidth={1.6}
                      />
                    </Button>
                    <Button
                      aria-label={
                        entry.kind === 'event' ? 'Löschen' : 'Stornieren'
                      }
                      onClick={() => {
                        if (entry.kind === 'event') {
                          if (!confirm('Diesen Eintrag löschen?')) return
                          deleteEvent(entry.id, {
                            onError: () =>
                              toast.error('Löschen fehlgeschlagen.'),
                          })
                        } else {
                          if (!confirm('Diese Reservierung stornieren?')) return
                          cancelBooking(entry.id, {
                            onError: () =>
                              toast.error('Stornieren fehlgeschlagen.'),
                          })
                        }
                      }}
                      size="icon-sm"
                      variant="ghost"
                    >
                      <HugeiconsIcon
                        aria-hidden="true"
                        icon={Delete02Icon}
                        size={16}
                        strokeWidth={1.6}
                      />
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/**
 * Personal iCal subscription URL + the e-mail-notification opt-in. The
 * bootstrap root admin has no profile row, so the notification toggle is
 * hidden when the profile can't be loaded.
 */
function SubscribePanel() {
  const { data: token } = useCalendarToken()
  const { mutate: createToken, isPending: isCreating } =
    useCreateCalendarToken()
  const { mutate: deleteToken } = useDeleteCalendarToken()
  const [feedUrl, setFeedUrl] = useState<string | null>(null)

  const { data: profile } = useMyProfile()
  const { mutate: updateProfile, isPending: isSavingProfile } =
    useUpdateMyProfile()

  return (
    <section className="space-y-4 rounded-[1.25rem] bg-white/60 p-4 ring-1 ring-inset ring-white/40 sm:p-5">
      <div className="flex items-center gap-2">
        <HugeiconsIcon
          aria-hidden="true"
          className="text-forest-700/70"
          icon={Calendar01Icon}
          size={18}
          strokeWidth={1.6}
        />
        <h2 className="font-display text-lg text-forest-900">
          Kalender abonnieren
        </h2>
      </div>

      <p className="text-sm text-forest-700/70">
        Abonniere den persönlichen iCal-Feed, um alle Termine automatisch in
        deiner Kalender-App zu sehen.
      </p>

      {feedUrl ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-forest-700/60">
            Deine Feed-URL (nur einmal sichtbar):
          </p>
          <div className="flex gap-2">
            <code className="flex-1 truncate rounded-xl bg-forest-900/6 px-3 py-2 text-xs text-forest-800">
              {feedUrl}
            </code>
            <Button
              aria-label="URL kopieren"
              onClick={() => {
                void navigator.clipboard.writeText(feedUrl)
                toast.success('Kopiert.')
              }}
              size="icon"
              variant="outline"
            >
              <HugeiconsIcon
                aria-hidden="true"
                icon={Copy01Icon}
                size={16}
                strokeWidth={1.6}
              />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={isCreating}
            onClick={() =>
              createToken(undefined, {
                onSuccess: (res) => setFeedUrl(res.url),
                onError: () =>
                  toast.error('Feed konnte nicht erstellt werden.'),
              })
            }
          >
            {token?.exists ? 'Feed-URL neu erzeugen' : 'Feed aktivieren'}
          </Button>
          {token?.exists && (
            <Button
              onClick={() =>
                deleteToken(undefined, {
                  onSuccess: () => toast.success('Feed deaktiviert.'),
                })
              }
              variant="outline"
            >
              Feed deaktivieren
            </Button>
          )}
        </div>
      )}

      {profile && (
        <label className="flex items-center gap-2 border-t border-forest-900/8 pt-4 text-sm text-forest-900">
          <input
            checked={profile.notify_calendar_email}
            className="size-4 accent-forest-700"
            disabled={isSavingProfile}
            onChange={(e) =>
              updateProfile(
                { notify_calendar_email: e.target.checked },
                {
                  onError: () =>
                    toast.error('Einstellung konnte nicht gespeichert werden.'),
                },
              )
            }
            type="checkbox"
          />
          E-Mail-Benachrichtigung bei Kalender-Änderungen
        </label>
      )}
    </section>
  )
}
