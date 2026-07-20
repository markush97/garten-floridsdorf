import { and, asc, eq, isNotNull } from 'drizzle-orm'
import { nowUtc } from '../../_lib/dayjs'
import type { Database } from '../../_lib/db'
import { AppError } from '../../_lib/errors'
import { generateSlug } from '../../_lib/slug'
import type {
  CreateUserInput,
  UpdateMyProfileInput,
  UpdateUserInput,
} from '../../contracts/user'
import { users } from '../schema'
import { findUserByUsername } from './auth'

// Everything except `password_hash` — this is what API responses may
// contain. Keep in sync with `userSchema` in contracts/user.ts.
export const publicUserColumns = {
  id: users.id,
  slug: users.slug,
  first_name: users.first_name,
  last_name: users.last_name,
  email: users.email,
  phone: users.phone,
  description: users.description,
  username: users.username,
  role: users.role,
  activated_at: users.activated_at,
  created_at: users.created_at,
  updated_at: users.updated_at,
}

function normalizeOptional(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function listAllUsers(db: Database) {
  return db
    .select(publicUserColumns)
    .from(users)
    .orderBy(asc(users.last_name), asc(users.first_name))
    .all()
}

export async function findUserBySlugOrThrow(db: Database, slug: string) {
  const user = await db
    .select(publicUserColumns)
    .from(users)
    .where(eq(users.slug, slug))
    .get()
  if (!user) {
    throw new AppError('NOT_FOUND', 'Benutzer nicht gefunden', 404)
  }
  return user
}

export async function findUserByIdOrThrow(db: Database, id: number) {
  const user = await db
    .select(publicUserColumns)
    .from(users)
    .where(eq(users.id, id))
    .get()
  if (!user) {
    throw new AppError('NOT_FOUND', 'Benutzer nicht gefunden', 404)
  }
  return user
}

export async function createUser(db: Database, input: CreateUserInput) {
  const now = nowUtc()
  const firstName = input.first_name.trim()
  const lastName = input.last_name.trim()
  const slug = generateSlug(`${firstName} ${lastName}`)
  const inserted = await db
    .insert(users)
    .values({
      slug,
      first_name: firstName,
      last_name: lastName,
      email: normalizeOptional(input.email),
      phone: normalizeOptional(input.phone),
      description: normalizeOptional(input.description),
      role: input.role ?? 'member',
      created_at: now,
      updated_at: now,
    })
    .returning(publicUserColumns)
  const newUser = inserted[0]
  if (!newUser) {
    throw new AppError(
      'INTERNAL_ERROR',
      'Fehler beim Anlegen des Benutzers',
      500,
    )
  }
  return newUser
}

export async function updateUser(
  db: Database,
  id: number,
  input: UpdateUserInput,
) {
  await findUserByIdOrThrow(db, id)
  const now = nowUtc()
  const updates: Partial<typeof users.$inferInsert> = { updated_at: now }
  if (input.first_name !== undefined) {
    updates.first_name = input.first_name.trim()
  }
  if (input.last_name !== undefined) {
    updates.last_name = input.last_name.trim()
  }
  if (input.email !== undefined) {
    updates.email = normalizeOptional(input.email)
  }
  if (input.phone !== undefined) {
    updates.phone = normalizeOptional(input.phone)
  }
  if (input.description !== undefined) {
    updates.description = normalizeOptional(input.description)
  }
  if (input.role !== undefined) {
    updates.role = input.role
  }

  // The slug intentionally stays stable on rename — regenerating it
  // would 404 the page the admin is currently editing.
  await db.update(users).set(updates).where(eq(users.id, id))
  return findUserByIdOrThrow(db, id)
}

export async function deleteUser(db: Database, id: number) {
  await findUserByIdOrThrow(db, id)
  await db.delete(users).where(eq(users.id, id))
}

// ── Profile self-service (`/api/me/*`) ─────────────────────────────────────

// What a member sees about themselves — the public columns plus the
// self-service-only fields. Keep in sync with `myProfileSchema`.
const profileColumns = {
  ...publicUserColumns,
  address: users.address,
  notify_calendar_email: users.notify_calendar_email,
}

export async function getProfileOrThrow(db: Database, userId: number) {
  const profile = await db
    .select(profileColumns)
    .from(users)
    .where(eq(users.id, userId))
    .get()
  if (!profile) {
    throw new AppError('NOT_FOUND', 'Benutzer nicht gefunden', 404)
  }
  return profile
}

export async function updateProfile(
  db: Database,
  userId: number,
  input: UpdateMyProfileInput,
) {
  await getProfileOrThrow(db, userId)
  if (input.username !== undefined) {
    const taken = await findUserByUsername(db, input.username)
    if (taken && taken.id !== userId) {
      throw new AppError('CONFLICT', 'Benutzername ist bereits vergeben', 409)
    }
  }
  const updates: Partial<typeof users.$inferInsert> = { updated_at: nowUtc() }
  if (input.first_name !== undefined) {
    updates.first_name = input.first_name.trim()
  }
  if (input.last_name !== undefined) {
    updates.last_name = input.last_name.trim()
  }
  if (input.username !== undefined) {
    updates.username = input.username
  }
  // No uniqueness check for e-mail: the column has no unique index
  // and the magic-link flow tolerates duplicates by design.
  if (input.email !== undefined) {
    updates.email = normalizeOptional(input.email)
  }
  if (input.phone !== undefined) {
    updates.phone = normalizeOptional(input.phone)
  }
  if (input.address !== undefined) {
    updates.address = normalizeOptional(input.address)
  }
  if (input.description !== undefined) {
    updates.description = normalizeOptional(input.description)
  }
  if (input.notify_calendar_email !== undefined) {
    updates.notify_calendar_email = input.notify_calendar_email
  }
  await db.update(users).set(updates).where(eq(users.id, userId))
  return getProfileOrThrow(db, userId)
}

export async function findUserCredentials(
  db: Database,
  userId: number,
): Promise<{ id: number; password_hash: string | null } | undefined> {
  return db
    .select({ id: users.id, password_hash: users.password_hash })
    .from(users)
    .where(eq(users.id, userId))
    .get()
}

export async function updatePassword(
  db: Database,
  userId: number,
  passwordHash: string,
): Promise<void> {
  await db
    .update(users)
    .set({ password_hash: passwordHash, updated_at: nowUtc() })
    .where(eq(users.id, userId))
}

/**
 * Recipients for calendar-change notification mails: opted in,
 * activated, with an e-mail address — excluding the acting user so
 * nobody is notified about their own change.
 */
export async function listCalendarNotificationRecipients(
  db: Database,
  excludeUserId: number | null,
): Promise<{ email: string }[]> {
  const rows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(
      and(
        eq(users.notify_calendar_email, true),
        isNotNull(users.activated_at),
        isNotNull(users.email),
      ),
    )
    .all()
  return rows
    .filter(
      (row): row is { id: number; email: string } =>
        row.email !== null && row.id !== excludeUserId,
    )
    .map((row) => ({ email: row.email }))
}
