import { asc, eq } from 'drizzle-orm'
import { nowUtc } from '../../_lib/dayjs'
import type { Database } from '../../_lib/db'
import { AppError } from '../../_lib/errors'
import { generateSlug } from '../../_lib/slug'
import type { CreateUserInput, UpdateUserInput } from '../../contracts/user'
import { users } from '../schema'

function normalizeOptional(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function listAllUsers(db: Database) {
  return db
    .select()
    .from(users)
    .orderBy(asc(users.last_name), asc(users.first_name))
    .all()
}

export async function findUserBySlugOrThrow(db: Database, slug: string) {
  const user = await db.select().from(users).where(eq(users.slug, slug)).get()
  if (!user) {
    throw new AppError('NOT_FOUND', 'Benutzer nicht gefunden', 404)
  }
  return user
}

export async function findUserByIdOrThrow(db: Database, id: number) {
  const user = await db.select().from(users).where(eq(users.id, id)).get()
  if (!user) {
    throw new AppError('NOT_FOUND', 'Benutzer nicht gefunden', 404)
  }
  return user
}

export async function createUser(db: Database, input: CreateUserInput) {
  const now = nowUtc()
  const firstName = input.first_name.trim()
  const lastName = input.last_name.trim()
  // D1 refuses Drizzle's `("id", ...) VALUES (null, ...)` for AUTOINCREMENT
  // tables with FK constraints — use raw SQL to omit the id column.
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
      created_at: now,
      updated_at: now,
    })
    .returning()
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
  const current = await findUserByIdOrThrow(db, id)
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

  // Regenerate the slug whenever the name changes so URLs stay readable.
  if (updates.first_name || updates.last_name) {
    const nextFirst = updates.first_name ?? current.first_name
    const nextLast = updates.last_name ?? current.last_name
    updates.slug = generateSlug(`${nextFirst} ${nextLast}`)
  }

  await db.update(users).set(updates).where(eq(users.id, id))
  return findUserByIdOrThrow(db, id)
}

export async function deleteUser(db: Database, id: number) {
  await findUserByIdOrThrow(db, id)
  await db.delete(users).where(eq(users.id, id))
}
