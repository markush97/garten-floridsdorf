import { and, eq, gt, gte, lt, lte, ne } from 'drizzle-orm'
import {
  type BookingPeriod,
  utcToBookingPeriod,
  validateBookingPeriod,
} from '../../_lib/booking'
import { formatTerminWhen } from '../../_lib/calendar-notifications'
import { DEFAULT_TIMEZONE, dayjs, nowUtc, toVienna } from '../../_lib/dayjs'
import type { Database } from '../../_lib/db'
import { AppError } from '../../_lib/errors'
import { normalizeOptional } from '../../_lib/strings'
import type { UpdateBookingInput } from '../../contracts/calendar'
import { type BookingRow, bookings, events } from '../schema'

export async function findBookingOrThrow(
  db: Database,
  id: number,
): Promise<BookingRow> {
  const row = await db.select().from(bookings).where(eq(bookings.id, id)).get()
  if (!row) {
    throw new AppError('NOT_FOUND', 'Reservierung nicht gefunden', 404)
  }
  return row
}

/**
 * Confirmed bookings intersecting [fromUtc, toUtc). Lexicographic
 * comparison is sound because every instant is written via
 * `.toISOString()` (see `_lib/booking.ts`).
 */
export async function listConfirmedBookingsInRange(
  db: Database,
  fromUtc: string,
  toUtc: string,
): Promise<BookingRow[]> {
  return db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.status, 'confirmed'),
        lt(bookings.start_at, toUtc),
        gt(bookings.end_at, fromUtc),
      ),
    )
    .all()
}

export async function findOverlappingBooking(
  db: Database,
  startAt: string,
  endAt: string,
  opts: { excludeId?: number } = {},
): Promise<BookingRow | undefined> {
  return db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.status, 'confirmed'),
        lt(bookings.start_at, endAt),
        gt(bookings.end_at, startAt),
        opts.excludeId !== undefined
          ? ne(bookings.id, opts.excludeId)
          : undefined,
      ),
    )
    .get()
}

/**
 * Vereinstermine inside the booking period — those block an
 * exclusive reservation. A timed Termin conflicts when the booking
 * covers its instant; a date-only Termin conflicts when the booking
 * overlaps any part of that Vienna day (conservative: the whole day
 * counts as occupied).
 */
export async function findConflictingVereinstermine(
  db: Database,
  startAt: string,
  endAt: string,
): Promise<
  {
    id: number
    title: string
    scheduled_date: string
    scheduled_time: string | null
  }[]
> {
  // Prefilter on the Vienna date span: a Termin dated outside
  // [start date, end date] cannot intersect the period.
  const fromDate = toVienna(startAt).format('YYYY-MM-DD')
  const toDate = toVienna(endAt).format('YYYY-MM-DD')
  const candidates = await db
    .select({
      id: events.id,
      title: events.title,
      scheduled_date: events.scheduled_date,
      scheduled_time: events.scheduled_time,
    })
    .from(events)
    .where(
      and(
        gte(events.scheduled_date, fromDate),
        lte(events.scheduled_date, toDate),
      ),
    )
    .all()

  return candidates.filter((termin) => {
    if (termin.scheduled_time) {
      const instant = dayjs
        .tz(
          `${termin.scheduled_date} ${termin.scheduled_time}`,
          DEFAULT_TIMEZONE,
        )
        .toISOString()
      return startAt <= instant && instant < endAt
    }
    const dayStart = dayjs.tz(
      `${termin.scheduled_date} 00:00`,
      DEFAULT_TIMEZONE,
    )
    const dayEnd = dayStart.add(1, 'day')
    return startAt < dayEnd.toISOString() && endAt > dayStart.toISOString()
  })
}

/** Statuten validation + conflict checks shared by create and update. */
async function assertBookablePeriod(
  db: Database,
  period: BookingPeriod,
  nowUtcIso: string,
  opts: { excludeId?: number } = {},
): Promise<{ start_at: string; end_at: string; billed_days: number }> {
  const validated = validateBookingPeriod(period, nowUtcIso)
  if (!validated.ok) {
    throw new AppError('VALIDATION_ERROR', validated.message, 400)
  }
  const overlap = await findOverlappingBooking(
    db,
    validated.start_at,
    validated.end_at,
    opts,
  )
  if (overlap) {
    throw new AppError(
      'CONFLICT',
      `Der Zeitraum überschneidet sich mit einer bestehenden Reservierung von ${overlap.user_name}.`,
      409,
    )
  }
  const termine = await findConflictingVereinstermine(
    db,
    validated.start_at,
    validated.end_at,
  )
  const termin = termine[0]
  if (termin) {
    throw new AppError(
      'CONFLICT',
      `Im gewählten Zeitraum findet ein Vereinstermin statt: „${termin.title}“ (${formatTerminWhen(termin.scheduled_date, termin.scheduled_time)}). Eine exklusive Reservierung ist hier nicht möglich.`,
      409,
    )
  }
  return {
    start_at: validated.start_at,
    end_at: validated.end_at,
    billed_days: validated.billed_days,
  }
}

export async function createBooking(
  db: Database,
  period: BookingPeriod,
  note: string | null | undefined,
  booker: { id: number | null; name: string },
  nowUtcIso: string,
): Promise<BookingRow> {
  const checked = await assertBookablePeriod(db, period, nowUtcIso)
  const now = nowUtc()
  const inserted = await db
    .insert(bookings)
    .values({
      user_id: booker.id,
      user_name: booker.name,
      start_at: checked.start_at,
      end_at: checked.end_at,
      billed_days: checked.billed_days,
      note: normalizeOptional(note),
      status: 'confirmed',
      created_at: now,
      updated_at: now,
    })
    .returning()
  const row = inserted[0]
  if (!row) {
    throw new AppError('INTERNAL_ERROR', 'Fehler beim Anlegen', 500)
  }

  // D1 offers no cross-statement transaction here, so two concurrent
  // creates can both pass the pre-check. Deterministic tie-break:
  // re-check after insert and the row with the HIGHER id removes
  // itself — both writers agree on the winner.
  const rival = await findOverlappingBooking(db, row.start_at, row.end_at, {
    excludeId: row.id,
  })
  if (rival && rival.id < row.id) {
    await db.delete(bookings).where(eq(bookings.id, row.id))
    throw new AppError(
      'CONFLICT',
      `Der Zeitraum überschneidet sich mit einer bestehenden Reservierung von ${rival.user_name}.`,
      409,
    )
  }
  return row
}

export async function updateBooking(
  db: Database,
  id: number,
  input: UpdateBookingInput,
  nowUtcIso: string,
): Promise<BookingRow> {
  const existing = await findBookingOrThrow(db, id)
  if (existing.status === 'cancelled') {
    throw new AppError(
      'VALIDATION_ERROR',
      'Eine stornierte Reservierung kann nicht geändert werden.',
      400,
    )
  }

  const currentPeriod = utcToBookingPeriod(existing.start_at, existing.end_at)
  const mergedPeriod: BookingPeriod = {
    start_date: input.start_date ?? currentPeriod.start_date,
    start_time: input.start_time ?? currentPeriod.start_time,
    end_date: input.end_date ?? currentPeriod.end_date,
    end_time: input.end_time ?? currentPeriod.end_time,
  }
  const periodChanged =
    mergedPeriod.start_date !== currentPeriod.start_date ||
    mergedPeriod.start_time !== currentPeriod.start_time ||
    mergedPeriod.end_date !== currentPeriod.end_date ||
    mergedPeriod.end_time !== currentPeriod.end_time

  const updates: Partial<typeof bookings.$inferInsert> = {
    updated_at: nowUtc(),
  }
  if (input.note !== undefined) {
    updates.note = normalizeOptional(input.note)
  }
  if (periodChanged) {
    // Full re-validation, exactly like a fresh booking — a note-only
    // edit deliberately skips this so it stays possible inside the
    // 7-day lead window.
    const checked = await assertBookablePeriod(db, mergedPeriod, nowUtcIso, {
      excludeId: id,
    })
    updates.start_at = checked.start_at
    updates.end_at = checked.end_at
    updates.billed_days = checked.billed_days
  }

  await db.update(bookings).set(updates).where(eq(bookings.id, id))
  return findBookingOrThrow(db, id)
}

export async function cancelBooking(
  db: Database,
  id: number,
): Promise<BookingRow> {
  const existing = await findBookingOrThrow(db, id)
  if (existing.status === 'cancelled') {
    throw new AppError(
      'VALIDATION_ERROR',
      'Reservierung ist bereits storniert.',
      400,
    )
  }
  const now = nowUtc()
  await db
    .update(bookings)
    .set({ status: 'cancelled', cancelled_at: now, updated_at: now })
    .where(eq(bookings.id, id))
  return findBookingOrThrow(db, id)
}
