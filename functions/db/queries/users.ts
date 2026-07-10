import { asc, eq } from 'drizzle-orm'
import { nowUtc } from '../../_lib/dayjs'
import type { Database } from '../../_lib/db'
import { AppError } from '../../_lib/errors'
import { generateSlug } from '../../_lib/slug'
import type { CreateUserInput, UpdateUserInput } from '../../contracts/user'
import { users } from '../schema'

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
