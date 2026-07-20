import {
  type BankEntryKind,
  EXPENSE_CADENCE_LABELS,
  EXPENSE_CADENCES,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_TYPE_LABELS,
  EXPENSE_TYPES,
  type ExpenseCadence,
  type ExpenseCategory,
  type ExpenseType,
  type GroupTotal,
  type KassaOverview,
  type MemberPosition,
  type PaidFrom,
  type Settlement,
} from '../contracts/bookkeeping'

/**
 * Pure ledger math for the Kassa (bookkeeping) module — no DB access,
 * so the whole balance/positions computation is unit-testable with
 * plain objects (same approach as `_lib/booking.ts`). All amounts are
 * integer euro cents. Only APPROVED expenses should be passed in.
 */

/** The subset of an approved expense the ledger cares about. */
export type LedgerExpense = {
  amount_cents: number
  type: ExpenseType
  category: ExpenseCategory
  cadence: ExpenseCadence
  paid_from: PaidFrom
  paid_by_user_id: number | null
  paid_by_name: string | null
  settlement: Settlement
}

/** A materialized split share of an approved expense. */
export type LedgerShare = {
  user_id: number | null
  member_name: string
  share_cents: number
}

/** A manual Vereinskonto movement. */
export type LedgerBankEntry = {
  kind: BankEntryKind
  amount_cents: number
  member_user_id: number | null
  member_name: string | null
}

/** A member of the Verein, used as the pool for a split. */
export type SplitMember = {
  user_id: number | null
  name: string
}

/**
 * Splits `amountCents` into equal integer-cent shares across
 * `members` (payer included, per the Verein rule). The rounding
 * remainder is assigned deterministically to the payer if they are in
 * the pool, otherwise to the first member — so the shares always sum
 * back to the exact amount. Returns [] for an empty pool.
 */
export function computeSplitShares(
  amountCents: number,
  members: SplitMember[],
  payerUserId: number | null,
): (SplitMember & { share_cents: number })[] {
  const n = members.length
  if (n === 0) return []
  const base = Math.floor(amountCents / n)
  let remainder = amountCents - base * n
  const remainderIdx = Math.max(
    0,
    payerUserId == null
      ? 0
      : members.findIndex((m) => m.user_id === payerUserId),
  )
  return members.map((m, i) => {
    const extra = i === remainderIdx ? remainder : 0
    // Guard: if the payer wasn't found, findIndex returned -1 → clamped
    // to 0, so the first member absorbs the remainder.
    if (i === remainderIdx) remainder = 0
    return { ...m, share_cents: base + extra }
  })
}

/** Stable position-map key: the user id, or a name for deleted users. */
function positionKey(userId: number | null, name: string): string {
  return userId == null ? `name:${name}` : `id:${userId}`
}

/**
 * Computes the whole budget-viewer payload from approved expenses,
 * their materialized split shares, and the manual bank entries.
 *
 * Balance:  Σ bank entries (opening/income +, reimbursement −)
 *           − Σ approved expenses paid from the Vereinskonto.
 * Position: what the Verein owes each member (positive) — a member
 *           who fronted money is owed it; a split share is a debt the
 *           member carries; reimbursements settle a debt; an income
 *           attributed to a member records them paying in on account.
 */
export function computeKassaOverview(
  expenses: LedgerExpense[],
  shares: LedgerShare[],
  bankEntries: LedgerBankEntry[],
  pendingCount: number,
): KassaOverview {
  let balance = 0
  for (const entry of bankEntries) {
    balance +=
      entry.kind === 'reimbursement' ? -entry.amount_cents : entry.amount_cents
  }
  for (const e of expenses) {
    if (e.paid_from === 'verein') balance -= e.amount_cents
  }

  const positions = new Map<
    string,
    { user_id: number | null; name: string; net_cents: number }
  >()
  const bump = (userId: number | null, name: string, delta: number) => {
    const key = positionKey(userId, name)
    const existing = positions.get(key)
    if (existing) {
      existing.net_cents += delta
      // Prefer a real name over an empty snapshot if one shows up later.
      if (!existing.name && name) existing.name = name
    } else {
      positions.set(key, { user_id: userId, name, net_cents: delta })
    }
  }

  for (const e of expenses) {
    if (e.paid_from === 'member' && e.paid_by_name) {
      bump(e.paid_by_user_id, e.paid_by_name, e.amount_cents)
    }
  }
  for (const s of shares) {
    bump(s.user_id, s.member_name, -s.share_cents)
  }
  for (const entry of bankEntries) {
    if (!entry.member_name) continue
    if (entry.kind === 'reimbursement') {
      bump(entry.member_user_id, entry.member_name, -entry.amount_cents)
    } else if (entry.kind === 'income') {
      bump(entry.member_user_id, entry.member_name, entry.amount_cents)
    }
  }

  const positionList: MemberPosition[] = [...positions.values()]
    .filter((p) => p.net_cents !== 0)
    .sort((a, b) => b.net_cents - a.net_cents)

  return {
    balance_cents: balance,
    total_expenses_cents: expenses.reduce((sum, e) => sum + e.amount_cents, 0),
    by_category: groupTotals(
      expenses,
      (e) => e.category,
      EXPENSE_CATEGORIES,
      EXPENSE_CATEGORY_LABELS,
    ),
    by_type: groupTotals(
      expenses,
      (e) => e.type,
      EXPENSE_TYPES,
      EXPENSE_TYPE_LABELS,
    ),
    by_cadence: groupTotals(
      expenses,
      (e) => e.cadence,
      EXPENSE_CADENCES,
      EXPENSE_CADENCE_LABELS,
    ),
    positions: positionList,
    pending_count: pendingCount,
  }
}

/** Sum expense amounts per group key, in the enum's order, dropping empties. */
function groupTotals<K extends string>(
  expenses: LedgerExpense[],
  keyOf: (e: LedgerExpense) => K,
  order: readonly K[],
  labels: Record<K, string>,
): GroupTotal[] {
  const totals = new Map<K, number>()
  for (const e of expenses) {
    const k = keyOf(e)
    totals.set(k, (totals.get(k) ?? 0) + e.amount_cents)
  }
  return order
    .filter((k) => (totals.get(k) ?? 0) !== 0)
    .map((k) => ({
      key: k,
      label: labels[k],
      total_cents: totals.get(k) ?? 0,
    }))
}
