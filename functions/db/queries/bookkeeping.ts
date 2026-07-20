import { and, asc, desc, eq, isNotNull } from 'drizzle-orm'
import type { Session } from '../../_lib/auth'
import {
  computeKassaOverview,
  computeSplitShares,
  type LedgerBankEntry,
  type LedgerExpense,
  type LedgerShare,
  type SplitMember,
} from '../../_lib/bookkeeping'
import { nowUtc } from '../../_lib/dayjs'
import type { Database } from '../../_lib/db'
import { AppError } from '../../_lib/errors'
import { normalizeOptional } from '../../_lib/strings'
import {
  type BankEntrySummary,
  bankEntryConsistencyIssue,
  type CreateBankEntryInput,
  type CreateExpenseInput,
  type ExpenseSummary,
  expenseConsistencyIssue,
  type KassaMember,
  type KassaOverview,
  type UpdateBankEntryInput,
  type UpdateExpenseInput,
} from '../../contracts/bookkeeping'
import {
  type BankEntryRow,
  bank_entries,
  type ExpenseRow,
  expense_shares,
  expenses,
  users,
} from '../schema'

// ── Permissions ──────────────────────────────────────────────────────────────

/**
 * Whether the session may accept (approve/reject) bills and manage
 * bank entries. Admins always may (including the bootstrap root admin,
 * whose `userId` is null); members need the `is_kassier` flag, read
 * fresh from the DB so a just-granted flag isn't stale in the JWT.
 */
export async function canApproveExpenses(
  db: Database,
  session: Session,
): Promise<boolean> {
  if (session.role === 'admin') return true
  if (session.userId === null) return false
  const row = await db
    .select({ is_kassier: users.is_kassier })
    .from(users)
    .where(eq(users.id, session.userId))
    .get()
  return row?.is_kassier ?? false
}

// ── Members ──────────────────────────────────────────────────────────────────

/** Activated members, for the payer / reimbursement pickers and split pool. */
export async function listMembers(db: Database): Promise<KassaMember[]> {
  const rows = await db
    .select({
      id: users.id,
      first_name: users.first_name,
      last_name: users.last_name,
    })
    .from(users)
    .where(isNotNull(users.activated_at))
    .orderBy(asc(users.last_name), asc(users.first_name))
    .all()
  return rows.map((r) => ({
    user_id: r.id,
    name: `${r.first_name} ${r.last_name}`,
  }))
}

async function findMemberName(db: Database, userId: number): Promise<string> {
  const row = await db
    .select({ first_name: users.first_name, last_name: users.last_name })
    .from(users)
    .where(eq(users.id, userId))
    .get()
  if (!row) {
    throw new AppError('VALIDATION_ERROR', 'Mitglied nicht gefunden', 400)
  }
  return `${row.first_name} ${row.last_name}`
}

// ── Expenses ─────────────────────────────────────────────────────────────────

function toExpenseSummary(row: ExpenseRow): ExpenseSummary {
  return {
    id: row.id,
    description: row.description,
    amount_cents: row.amount_cents,
    expense_date: row.expense_date,
    type: row.type,
    category: row.category,
    cadence: row.cadence,
    project_name: row.project_name,
    paid_from: row.paid_from,
    paid_by_user_id: row.paid_by_user_id,
    paid_by_name: row.paid_by_name,
    settlement: row.settlement,
    status: row.status,
    has_receipt: row.receipt_r2_key !== null,
    receipt_filename: row.receipt_filename,
    submitted_by_user_id: row.submitted_by_user_id,
    submitted_by_name: row.submitted_by_name,
    reviewed_by_name: row.reviewed_by_name,
    reviewed_at: row.reviewed_at,
    review_note: row.review_note,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function findExpenseOrThrow(
  db: Database,
  id: number,
): Promise<ExpenseRow> {
  const row = await db.select().from(expenses).where(eq(expenses.id, id)).get()
  if (!row) {
    throw new AppError('NOT_FOUND', 'Rechnung nicht gefunden', 404)
  }
  return row
}

export async function listExpenses(db: Database): Promise<ExpenseSummary[]> {
  const rows = await db
    .select()
    .from(expenses)
    .orderBy(desc(expenses.expense_date), desc(expenses.id))
    .all()
  return rows.map(toExpenseSummary)
}

export async function createExpense(
  db: Database,
  input: CreateExpenseInput,
  submitter: { id: number | null; name: string },
): Promise<ExpenseSummary> {
  const now = nowUtc()
  const paidByUserId =
    input.paid_from === 'member' ? (input.paid_by_user_id ?? null) : null
  const paidByName =
    paidByUserId !== null ? await findMemberName(db, paidByUserId) : null
  const inserted = await db
    .insert(expenses)
    .values({
      description: input.description,
      amount_cents: input.amount_cents,
      expense_date: input.expense_date,
      type: input.type,
      category: input.category,
      cadence: input.cadence,
      project_name:
        input.type === 'project' ? normalizeOptional(input.project_name) : null,
      paid_from: input.paid_from,
      paid_by_user_id: paidByUserId,
      paid_by_name: paidByName,
      settlement: input.settlement,
      status: 'pending',
      submitted_by_user_id: submitter.id,
      submitted_by_name: submitter.name,
      created_at: now,
      updated_at: now,
    })
    .returning()
  const row = inserted[0]
  if (!row) throw new AppError('INTERNAL_ERROR', 'Fehler beim Anlegen', 500)
  return toExpenseSummary(row)
}

export async function updateExpense(
  db: Database,
  id: number,
  input: UpdateExpenseInput,
): Promise<ExpenseSummary> {
  const existing = await findExpenseOrThrow(db, id)
  const updates: Partial<typeof expenses.$inferInsert> = {
    updated_at: nowUtc(),
  }

  if (input.description !== undefined) updates.description = input.description
  if (input.amount_cents !== undefined)
    updates.amount_cents = input.amount_cents
  if (input.expense_date !== undefined)
    updates.expense_date = input.expense_date
  if (input.type !== undefined) updates.type = input.type
  if (input.category !== undefined) updates.category = input.category
  if (input.cadence !== undefined) updates.cadence = input.cadence
  if (input.project_name !== undefined) {
    updates.project_name = normalizeOptional(input.project_name)
  }
  if (input.paid_from !== undefined) updates.paid_from = input.paid_from
  if (input.paid_by_user_id !== undefined) {
    updates.paid_by_user_id = input.paid_by_user_id ?? null
  }
  if (input.settlement !== undefined) updates.settlement = input.settlement

  const merged = { ...existing, ...updates }

  // A Verein-paid bill never carries a payer; a project bill needs a name.
  if (merged.paid_from === 'verein') {
    updates.paid_by_user_id = null
    merged.paid_by_user_id = null
  }
  if (merged.type !== 'project') {
    updates.project_name = null
    merged.project_name = null
  }

  const issue = expenseConsistencyIssue({
    type: merged.type,
    paid_from: merged.paid_from,
    paid_by_user_id: merged.paid_by_user_id,
    project_name: merged.project_name,
  })
  if (issue) throw new AppError('VALIDATION_ERROR', issue, 400)

  // Keep the payer-name snapshot in sync with the payer id.
  if (merged.paid_from === 'member' && merged.paid_by_user_id !== null) {
    updates.paid_by_name = await findMemberName(db, merged.paid_by_user_id)
  } else {
    updates.paid_by_name = null
  }

  await db.update(expenses).set(updates).where(eq(expenses.id, id))
  return toExpenseSummary(await findExpenseOrThrow(db, id))
}

export async function deleteExpense(
  db: Database,
  bucket: R2Bucket,
  id: number,
): Promise<void> {
  const row = await findExpenseOrThrow(db, id)
  if (row.receipt_r2_key) {
    await bucket.delete(row.receipt_r2_key)
  }
  await db.delete(expenses).where(eq(expenses.id, id))
}

/** Records (or replaces) the receipt scan for a bill. */
export async function setExpenseReceipt(
  db: Database,
  bucket: R2Bucket,
  id: number,
  receipt: {
    r2_key: string
    filename: string
    content_type: string
    size: number
  },
): Promise<ExpenseSummary> {
  const existing = await findExpenseOrThrow(db, id)
  if (existing.receipt_r2_key && existing.receipt_r2_key !== receipt.r2_key) {
    await bucket.delete(existing.receipt_r2_key)
  }
  await db
    .update(expenses)
    .set({
      receipt_r2_key: receipt.r2_key,
      receipt_filename: receipt.filename,
      receipt_content_type: receipt.content_type,
      receipt_size: receipt.size,
      updated_at: nowUtc(),
    })
    .where(eq(expenses.id, id))
  return toExpenseSummary(await findExpenseOrThrow(db, id))
}

/**
 * Approves a bill. For a split settlement the per-member shares are
 * materialized from the current activated members so historical debts
 * stay frozen. Any existing shares are cleared first so re-approving
 * is idempotent.
 */
export async function approveExpense(
  db: Database,
  id: number,
  reviewer: { id: number | null; name: string },
): Promise<ExpenseSummary> {
  const row = await findExpenseOrThrow(db, id)
  await db.delete(expense_shares).where(eq(expense_shares.expense_id, id))

  if (row.settlement === 'split') {
    const members = await listMembers(db)
    const pool: SplitMember[] = members.map((m) => ({
      user_id: m.user_id,
      name: m.name,
    }))
    const shares = computeSplitShares(
      row.amount_cents,
      pool,
      row.paid_by_user_id,
    )
    if (shares.length > 0) {
      await db.insert(expense_shares).values(
        shares.map((s) => ({
          expense_id: id,
          user_id: s.user_id,
          member_name: s.name,
          share_cents: s.share_cents,
        })),
      )
    }
  }

  await db
    .update(expenses)
    .set({
      status: 'approved',
      reviewed_by_user_id: reviewer.id,
      reviewed_by_name: reviewer.name,
      reviewed_at: nowUtc(),
      review_note: null,
      updated_at: nowUtc(),
    })
    .where(eq(expenses.id, id))
  return toExpenseSummary(await findExpenseOrThrow(db, id))
}

export async function rejectExpense(
  db: Database,
  id: number,
  reviewer: { id: number | null; name: string },
  note: string | null,
): Promise<ExpenseSummary> {
  await findExpenseOrThrow(db, id)
  // A rejected bill never counts — drop any shares from a prior approval.
  await db.delete(expense_shares).where(eq(expense_shares.expense_id, id))
  await db
    .update(expenses)
    .set({
      status: 'rejected',
      reviewed_by_user_id: reviewer.id,
      reviewed_by_name: reviewer.name,
      reviewed_at: nowUtc(),
      review_note: normalizeOptional(note),
      updated_at: nowUtc(),
    })
    .where(eq(expenses.id, id))
  return toExpenseSummary(await findExpenseOrThrow(db, id))
}

// ── Bank entries ─────────────────────────────────────────────────────────────

function toBankEntrySummary(row: BankEntryRow): BankEntrySummary {
  return {
    id: row.id,
    kind: row.kind,
    amount_cents: row.amount_cents,
    entry_date: row.entry_date,
    description: row.description,
    member_user_id: row.member_user_id,
    member_name: row.member_name,
    recorded_by_name: row.recorded_by_name,
    created_at: row.created_at,
  }
}

async function findBankEntryOrThrow(
  db: Database,
  id: number,
): Promise<BankEntryRow> {
  const row = await db
    .select()
    .from(bank_entries)
    .where(eq(bank_entries.id, id))
    .get()
  if (!row) throw new AppError('NOT_FOUND', 'Buchung nicht gefunden', 404)
  return row
}

export async function listBankEntries(
  db: Database,
): Promise<BankEntrySummary[]> {
  const rows = await db
    .select()
    .from(bank_entries)
    .orderBy(desc(bank_entries.entry_date), desc(bank_entries.id))
    .all()
  return rows.map(toBankEntrySummary)
}

export async function createBankEntry(
  db: Database,
  input: CreateBankEntryInput,
  recorder: { id: number | null; name: string },
): Promise<BankEntrySummary> {
  const now = nowUtc()
  const memberUserId = input.member_user_id ?? null
  const memberName =
    memberUserId !== null ? await findMemberName(db, memberUserId) : null
  const inserted = await db
    .insert(bank_entries)
    .values({
      kind: input.kind,
      amount_cents: input.amount_cents,
      entry_date: input.entry_date,
      description: normalizeOptional(input.description),
      member_user_id: memberUserId,
      member_name: memberName,
      recorded_by_user_id: recorder.id,
      recorded_by_name: recorder.name,
      created_at: now,
      updated_at: now,
    })
    .returning()
  const row = inserted[0]
  if (!row) throw new AppError('INTERNAL_ERROR', 'Fehler beim Anlegen', 500)
  return toBankEntrySummary(row)
}

export async function updateBankEntry(
  db: Database,
  id: number,
  input: UpdateBankEntryInput,
): Promise<BankEntrySummary> {
  const existing = await findBankEntryOrThrow(db, id)
  const updates: Partial<typeof bank_entries.$inferInsert> = {
    updated_at: nowUtc(),
  }
  if (input.kind !== undefined) updates.kind = input.kind
  if (input.amount_cents !== undefined)
    updates.amount_cents = input.amount_cents
  if (input.entry_date !== undefined) updates.entry_date = input.entry_date
  if (input.description !== undefined) {
    updates.description = normalizeOptional(input.description)
  }
  if (input.member_user_id !== undefined) {
    updates.member_user_id = input.member_user_id ?? null
  }

  const merged = { ...existing, ...updates }
  const issue = bankEntryConsistencyIssue({
    kind: merged.kind,
    member_user_id: merged.member_user_id ?? null,
  })
  if (issue) throw new AppError('VALIDATION_ERROR', issue, 400)

  updates.member_name =
    merged.member_user_id != null
      ? await findMemberName(db, merged.member_user_id)
      : null

  await db.update(bank_entries).set(updates).where(eq(bank_entries.id, id))
  return toBankEntrySummary(await findBankEntryOrThrow(db, id))
}

export async function deleteBankEntry(db: Database, id: number): Promise<void> {
  await findBankEntryOrThrow(db, id)
  await db.delete(bank_entries).where(eq(bank_entries.id, id))
}

// ── Overview (budget viewer) ─────────────────────────────────────────────────

export async function getKassaOverview(db: Database): Promise<KassaOverview> {
  const allExpenses = await db.select().from(expenses).all()
  const approved = allExpenses.filter((e) => e.status === 'approved')
  const pendingCount = allExpenses.filter((e) => e.status === 'pending').length

  const shareRows = await db
    .select({
      user_id: expense_shares.user_id,
      member_name: expense_shares.member_name,
      share_cents: expense_shares.share_cents,
      status: expenses.status,
      settlement: expenses.settlement,
    })
    .from(expense_shares)
    .innerJoin(expenses, eq(expense_shares.expense_id, expenses.id))
    .where(
      and(eq(expenses.status, 'approved'), eq(expenses.settlement, 'split')),
    )
    .all()

  const bankRows = await db.select().from(bank_entries).all()

  const ledgerExpenses: LedgerExpense[] = approved.map((e) => ({
    amount_cents: e.amount_cents,
    type: e.type,
    category: e.category,
    cadence: e.cadence,
    paid_from: e.paid_from,
    paid_by_user_id: e.paid_by_user_id,
    paid_by_name: e.paid_by_name,
    settlement: e.settlement,
  }))
  const ledgerShares: LedgerShare[] = shareRows.map((s) => ({
    user_id: s.user_id,
    member_name: s.member_name,
    share_cents: s.share_cents,
  }))
  const ledgerBank: LedgerBankEntry[] = bankRows.map((b) => ({
    kind: b.kind,
    amount_cents: b.amount_cents,
    member_user_id: b.member_user_id,
    member_name: b.member_name,
  }))

  return computeKassaOverview(
    ledgerExpenses,
    ledgerShares,
    ledgerBank,
    pendingCount,
  )
}
