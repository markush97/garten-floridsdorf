import { and, asc, desc, eq, inArray, isNotNull, type SQL } from 'drizzle-orm'
import type { Session } from '../../_lib/auth'
import {
  computeKassaOverview,
  computeSplitShares,
  type LedgerBankEntry,
  type LedgerExpense,
  type LedgerMemberPayment,
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
  type CreateMemberPaymentInput,
  type ExpenseDebtor,
  type ExpenseSummary,
  expenseConsistencyIssue,
  type KassaMember,
  type KassaOverview,
  type MemberPaymentSummary,
  memberPaymentConsistencyIssue,
  type UpdateBankEntryInput,
  type UpdateExpenseInput,
  type UpdateMemberPaymentInput,
} from '../../contracts/bookkeeping'
import {
  type BankEntryRow,
  bank_entries,
  type ExpenseRow,
  expense_debtors,
  expense_shares,
  expenses,
  type MemberPaymentRow,
  member_payments,
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

/**
 * Activated members — the pool a split bill is divided among. Only
 * activated accounts carry debts, so this stays filtered (see
 * `approveExpense`). For the payer / reimbursement pickers use
 * `listMemberOptions` instead.
 */
export async function listMembers(db: Database): Promise<KassaMember[]> {
  return selectMembers(db, isNotNull(users.activated_at))
}

/**
 * Every member on file, for the payer / reimbursement pickers. Not
 * filtered by activation: someone who was invited but has never logged
 * in can still have paid for something the Kassa needs to record.
 */
export async function listMemberOptions(db: Database): Promise<KassaMember[]> {
  return selectMembers(db)
}

async function selectMembers(
  db: Database,
  where?: SQL | undefined,
): Promise<KassaMember[]> {
  const rows = await db
    .select({
      id: users.id,
      first_name: users.first_name,
      last_name: users.last_name,
    })
    .from(users)
    .where(where)
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

/**
 * Name snapshots for a set of member ids, in the given order. Throws if
 * one of the ids doesn't exist so a bad selection can't be stored.
 */
async function findMemberNames(
  db: Database,
  userIds: number[],
): Promise<{ user_id: number; name: string }[]> {
  if (userIds.length === 0) return []
  const rows = await db
    .select({
      id: users.id,
      first_name: users.first_name,
      last_name: users.last_name,
    })
    .from(users)
    .where(inArray(users.id, userIds))
    .all()
  const byId = new Map(
    rows.map((r) => [r.id, `${r.first_name} ${r.last_name}`] as const),
  )
  return userIds.map((id) => {
    const name = byId.get(id)
    if (!name) {
      throw new AppError('VALIDATION_ERROR', 'Mitglied nicht gefunden', 400)
    }
    return { user_id: id, name }
  })
}

// ── Expenses ─────────────────────────────────────────────────────────────────

function toExpenseSummary(
  row: ExpenseRow,
  debtors: ExpenseDebtor[],
): ExpenseSummary {
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
    debtors,
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

/** The picked cost bearers of one bill, in name order. */
async function listExpenseDebtors(
  db: Database,
  expenseId: number,
): Promise<ExpenseDebtor[]> {
  const rows = await db
    .select({
      user_id: expense_debtors.user_id,
      name: expense_debtors.member_name,
    })
    .from(expense_debtors)
    .where(eq(expense_debtors.expense_id, expenseId))
    .orderBy(asc(expense_debtors.member_name))
    .all()
  return rows
}

/** Loads a bill together with its cost bearers. */
async function loadExpenseSummary(
  db: Database,
  id: number,
): Promise<ExpenseSummary> {
  const row = await findExpenseOrThrow(db, id)
  return toExpenseSummary(row, await listExpenseDebtors(db, id))
}

/**
 * Replaces the stored cost bearers of a bill. `userIds` is only
 * honoured for a `selected` settlement — the other settlements derive
 * their pool at approval time, so their selection is cleared.
 */
async function replaceExpenseDebtors(
  db: Database,
  expenseId: number,
  settlement: ExpenseRow['settlement'],
  userIds: number[] | undefined,
): Promise<void> {
  if (settlement !== 'selected') {
    await db
      .delete(expense_debtors)
      .where(eq(expense_debtors.expense_id, expenseId))
    return
  }
  if (userIds === undefined) return
  const members = await findMemberNames(db, userIds)
  await db
    .delete(expense_debtors)
    .where(eq(expense_debtors.expense_id, expenseId))
  if (members.length === 0) return
  await db.insert(expense_debtors).values(
    members.map((m) => ({
      expense_id: expenseId,
      user_id: m.user_id,
      member_name: m.name,
    })),
  )
}

export async function listExpenses(db: Database): Promise<ExpenseSummary[]> {
  const rows = await db
    .select()
    .from(expenses)
    .orderBy(desc(expenses.expense_date), desc(expenses.id))
    .all()
  // One query for every bill's cost bearers, grouped in memory.
  const debtorRows = await db
    .select({
      expense_id: expense_debtors.expense_id,
      user_id: expense_debtors.user_id,
      name: expense_debtors.member_name,
    })
    .from(expense_debtors)
    .orderBy(asc(expense_debtors.member_name))
    .all()
  const byExpense = new Map<number, ExpenseDebtor[]>()
  for (const d of debtorRows) {
    const list = byExpense.get(d.expense_id)
    const debtor = { user_id: d.user_id, name: d.name }
    if (list) list.push(debtor)
    else byExpense.set(d.expense_id, [debtor])
  }
  return rows.map((row) => toExpenseSummary(row, byExpense.get(row.id) ?? []))
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
  await replaceExpenseDebtors(
    db,
    row.id,
    row.settlement,
    input.debtor_user_ids ?? [],
  )
  return loadExpenseSummary(db, row.id)
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

  // The selection either comes with the request or stays as stored.
  const debtorCount =
    merged.settlement === 'selected'
      ? (input.debtor_user_ids ?? (await listExpenseDebtors(db, id))).length
      : 0

  const issue = expenseConsistencyIssue({
    type: merged.type,
    paid_from: merged.paid_from,
    paid_by_user_id: merged.paid_by_user_id,
    project_name: merged.project_name,
    settlement: merged.settlement,
    debtor_count: debtorCount,
  })
  if (issue) throw new AppError('VALIDATION_ERROR', issue, 400)

  // Keep the payer-name snapshot in sync with the payer id.
  if (merged.paid_from === 'member' && merged.paid_by_user_id !== null) {
    updates.paid_by_name = await findMemberName(db, merged.paid_by_user_id)
  } else {
    updates.paid_by_name = null
  }

  await db.update(expenses).set(updates).where(eq(expenses.id, id))
  await replaceExpenseDebtors(db, id, merged.settlement, input.debtor_user_ids)
  // An already accepted bill keeps its shares in sync with the edit —
  // otherwise the frozen shares would no longer sum to the amount.
  const updated = await findExpenseOrThrow(db, id)
  if (updated.status === 'approved') {
    await materializeShares(db, updated)
  }
  return loadExpenseSummary(db, id)
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
  return loadExpenseSummary(db, id)
}

/**
 * (Re-)materializes the per-member shares of a bill so the debt each
 * member carries is frozen at this moment — later membership changes
 * must not shift historical shares. The pool is every activated member
 * for a `split` bill and the stored selection for a `selected` one; a
 * bill the Vereinskassa bears has no shares. Existing shares are
 * cleared first, so calling this again is idempotent.
 */
async function materializeShares(db: Database, row: ExpenseRow): Promise<void> {
  await db.delete(expense_shares).where(eq(expense_shares.expense_id, row.id))
  if (row.settlement === 'verein') return

  const pool: SplitMember[] =
    row.settlement === 'split'
      ? (await listMembers(db)).map((m) => ({
          user_id: m.user_id,
          name: m.name,
        }))
      : (await listExpenseDebtors(db, row.id)).map((d) => ({
          user_id: d.user_id,
          name: d.name,
        }))
  const shares = computeSplitShares(row.amount_cents, pool, row.paid_by_user_id)
  if (shares.length === 0) return
  await db.insert(expense_shares).values(
    shares.map((s) => ({
      expense_id: row.id,
      user_id: s.user_id,
      member_name: s.name,
      share_cents: s.share_cents,
    })),
  )
}

/** Approves a bill and freezes its per-member shares. */
export async function approveExpense(
  db: Database,
  id: number,
  reviewer: { id: number | null; name: string },
): Promise<ExpenseSummary> {
  const row = await findExpenseOrThrow(db, id)
  await materializeShares(db, row)

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
  return loadExpenseSummary(db, id)
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
  return loadExpenseSummary(db, id)
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

// ── Member payments (member pays another member back) ────────────────────────

function toMemberPaymentSummary(row: MemberPaymentRow): MemberPaymentSummary {
  return {
    id: row.id,
    from_user_id: row.from_user_id,
    from_name: row.from_name,
    to_user_id: row.to_user_id,
    to_name: row.to_name,
    amount_cents: row.amount_cents,
    payment_date: row.payment_date,
    description: row.description,
    recorded_by_user_id: row.recorded_by_user_id,
    recorded_by_name: row.recorded_by_name,
    created_at: row.created_at,
  }
}

export async function findMemberPaymentOrThrow(
  db: Database,
  id: number,
): Promise<MemberPaymentRow> {
  const row = await db
    .select()
    .from(member_payments)
    .where(eq(member_payments.id, id))
    .get()
  if (!row) throw new AppError('NOT_FOUND', 'Rückzahlung nicht gefunden', 404)
  return row
}

export async function listMemberPayments(
  db: Database,
): Promise<MemberPaymentSummary[]> {
  const rows = await db
    .select()
    .from(member_payments)
    .orderBy(desc(member_payments.payment_date), desc(member_payments.id))
    .all()
  return rows.map(toMemberPaymentSummary)
}

export async function createMemberPayment(
  db: Database,
  input: CreateMemberPaymentInput,
  recorder: { id: number | null; name: string },
): Promise<MemberPaymentSummary> {
  const now = nowUtc()
  const [from, to] = await Promise.all([
    findMemberName(db, input.from_user_id),
    findMemberName(db, input.to_user_id),
  ])
  const inserted = await db
    .insert(member_payments)
    .values({
      from_user_id: input.from_user_id,
      from_name: from,
      to_user_id: input.to_user_id,
      to_name: to,
      amount_cents: input.amount_cents,
      payment_date: input.payment_date,
      description: normalizeOptional(input.description),
      recorded_by_user_id: recorder.id,
      recorded_by_name: recorder.name,
      created_at: now,
      updated_at: now,
    })
    .returning()
  const row = inserted[0]
  if (!row) throw new AppError('INTERNAL_ERROR', 'Fehler beim Anlegen', 500)
  return toMemberPaymentSummary(row)
}

export async function updateMemberPayment(
  db: Database,
  id: number,
  input: UpdateMemberPaymentInput,
): Promise<MemberPaymentSummary> {
  const existing = await findMemberPaymentOrThrow(db, id)
  const updates: Partial<typeof member_payments.$inferInsert> = {
    updated_at: nowUtc(),
  }
  if (input.from_user_id !== undefined)
    updates.from_user_id = input.from_user_id
  if (input.to_user_id !== undefined) updates.to_user_id = input.to_user_id
  if (input.amount_cents !== undefined) {
    updates.amount_cents = input.amount_cents
  }
  if (input.payment_date !== undefined) {
    updates.payment_date = input.payment_date
  }
  if (input.description !== undefined) {
    updates.description = normalizeOptional(input.description)
  }

  const merged = { ...existing, ...updates }
  if (merged.from_user_id == null || merged.to_user_id == null) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Zahler:in und Empfänger:in müssen gesetzt sein.',
      400,
    )
  }
  const issue = memberPaymentConsistencyIssue({
    from_user_id: merged.from_user_id,
    to_user_id: merged.to_user_id,
  })
  if (issue) throw new AppError('VALIDATION_ERROR', issue, 400)

  // Keep both name snapshots in sync with the ids.
  updates.from_name = await findMemberName(db, merged.from_user_id)
  updates.to_name = await findMemberName(db, merged.to_user_id)

  await db
    .update(member_payments)
    .set(updates)
    .where(eq(member_payments.id, id))
  return toMemberPaymentSummary(await findMemberPaymentOrThrow(db, id))
}

export async function deleteMemberPayment(
  db: Database,
  id: number,
): Promise<void> {
  await findMemberPaymentOrThrow(db, id)
  await db.delete(member_payments).where(eq(member_payments.id, id))
}

/**
 * Whether the session may edit or delete a recorded payback: Kassiere
 * and admins always may, a member only the ones they recorded
 * themselves.
 */
export async function canManageMemberPayment(
  db: Database,
  session: Session,
  row: MemberPaymentRow,
): Promise<boolean> {
  if (await canApproveExpenses(db, session)) return true
  return (
    row.recorded_by_user_id !== null &&
    row.recorded_by_user_id === session.userId
  )
}

// ── Overview (budget viewer) ─────────────────────────────────────────────────

export async function getKassaOverview(db: Database): Promise<KassaOverview> {
  const allExpenses = await db.select().from(expenses).all()
  const approved = allExpenses.filter((e) => e.status === 'approved')
  const pendingCount = allExpenses.filter((e) => e.status === 'pending').length

  // The bill's payer travels with the share: they are the creditor the
  // share is owed to (the Vereinskassa when the bill was paid from the
  // Vereinskonto).
  const shareRows = await db
    .select({
      user_id: expense_shares.user_id,
      member_name: expense_shares.member_name,
      share_cents: expense_shares.share_cents,
      paid_from: expenses.paid_from,
      paid_by_user_id: expenses.paid_by_user_id,
      paid_by_name: expenses.paid_by_name,
    })
    .from(expense_shares)
    .innerJoin(expenses, eq(expense_shares.expense_id, expenses.id))
    .where(
      and(
        eq(expenses.status, 'approved'),
        inArray(expenses.settlement, ['split', 'selected']),
      ),
    )
    .all()

  const bankRows = await db.select().from(bank_entries).all()
  const paymentRows = await db.select().from(member_payments).all()

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
    paid_from: s.paid_from,
    paid_by_user_id: s.paid_by_user_id,
    paid_by_name: s.paid_by_name,
  }))
  const ledgerBank: LedgerBankEntry[] = bankRows.map((b) => ({
    kind: b.kind,
    amount_cents: b.amount_cents,
    member_user_id: b.member_user_id,
    member_name: b.member_name,
  }))
  const ledgerPayments: LedgerMemberPayment[] = paymentRows.map((p) => ({
    from_user_id: p.from_user_id,
    from_name: p.from_name,
    to_user_id: p.to_user_id,
    to_name: p.to_name,
    amount_cents: p.amount_cents,
  }))

  return computeKassaOverview(
    ledgerExpenses,
    ledgerShares,
    ledgerBank,
    ledgerPayments,
    pendingCount,
  )
}
