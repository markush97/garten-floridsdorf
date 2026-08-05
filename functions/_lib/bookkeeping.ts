import {
  type BankEntryKind,
  type DebtParty,
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
  type OutstandingDebt,
  type PaidFrom,
  type Settlement,
  VEREIN_PARTY_NAME,
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

/**
 * A materialized split share of an approved expense, carrying the
 * bill's payer so the debt can be booked against the right creditor:
 * the member who fronted the money, or the Vereinskassa.
 */
export type LedgerShare = {
  user_id: number | null
  member_name: string
  share_cents: number
  paid_from: PaidFrom
  paid_by_user_id: number | null
  paid_by_name: string | null
}

/** A manual Vereinskonto movement. */
export type LedgerBankEntry = {
  kind: BankEntryKind
  amount_cents: number
  member_user_id: number | null
  member_name: string | null
}

/** A payback handed from one member directly to another. */
export type LedgerMemberPayment = {
  from_user_id: number | null
  from_name: string
  to_user_id: number | null
  to_name: string
  amount_cents: number
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

/** The Vereinskassa as a party of the debt ledger. */
const VEREIN: DebtParty = {
  kind: 'verein',
  user_id: null,
  name: VEREIN_PARTY_NAME,
}

function memberParty(userId: number | null, name: string): DebtParty {
  return { kind: 'member', user_id: userId, name }
}

/** Stable party key: the Verein, a user id, or a name for deleted users. */
function partyKey(party: DebtParty): string {
  if (party.kind === 'verein') return 'verein'
  return party.user_id == null ? `name:${party.name}` : `id:${party.user_id}`
}

/** The netted balance between two parties: `a` owes `b` `cents` (may be < 0). */
type PairBalance = { a: DebtParty; b: DebtParty; cents: number }

/**
 * Books `amount` cents of obligation from `debtor` to `creditor` into
 * the per-pair netting map. A *payment* is booked as a negative amount
 * in the direction of the debt it settles, so money handed over and
 * debt incurred cancel out on the same pair. Self-debts (a member's own
 * share of a bill they fronted) are dropped.
 */
function owe(
  pairs: Map<string, PairBalance>,
  debtor: DebtParty,
  creditor: DebtParty,
  amount: number,
): void {
  const debtorKey = partyKey(debtor)
  const creditorKey = partyKey(creditor)
  if (debtorKey === creditorKey || amount === 0) return
  // Orient the pair deterministically so both directions land on one row.
  const forward = debtorKey < creditorKey
  const [a, b] = forward ? [debtor, creditor] : [creditor, debtor]
  const key = `${partyKey(a)}|${partyKey(b)}`
  const existing = pairs.get(key)
  const delta = forward ? amount : -amount
  if (existing) {
    existing.cents += delta
  } else {
    pairs.set(key, { a, b, cents: delta })
  }
}

/**
 * Computes the whole budget-viewer payload from approved expenses,
 * their materialized split shares, the manual bank entries and the
 * member-to-member paybacks.
 *
 * Balance:  Σ bank entries (opening/income +, reimbursement −)
 *           − Σ approved expenses paid from the Vereinskonto.
 * Position: each party's net over every obligation (positive = gets
 *           money back). Whoever fronted a bill is the creditor — a
 *           member privately, otherwise the Vereinskassa; every
 *           materialized share is a debt of that member towards the
 *           creditor. A privately paid bill the Vereinskassa bears is a
 *           debt of the Verein towards the payer. Reimbursements,
 *           member income entries and paybacks settle those debts.
 *           Only members are reported (`positions`).
 * Debts:    the consolidated settlement plan for those nets, see
 *           `consolidateDebts`.
 */
export function computeKassaOverview(
  expenses: LedgerExpense[],
  shares: LedgerShare[],
  bankEntries: LedgerBankEntry[],
  memberPayments: LedgerMemberPayment[],
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

  const pairs = new Map<string, PairBalance>()

  for (const e of expenses) {
    // A member fronted a bill the Vereinskassa bears → the Verein owes
    // them the full amount. Split bills are covered by their shares.
    if (
      e.paid_from === 'member' &&
      e.paid_by_name &&
      e.settlement === 'verein'
    ) {
      owe(
        pairs,
        VEREIN,
        memberParty(e.paid_by_user_id, e.paid_by_name),
        e.amount_cents,
      )
    }
  }
  for (const s of shares) {
    const creditor =
      s.paid_from === 'member' && s.paid_by_name
        ? memberParty(s.paid_by_user_id, s.paid_by_name)
        : VEREIN
    owe(pairs, memberParty(s.user_id, s.member_name), creditor, s.share_cents)
  }
  for (const entry of bankEntries) {
    if (!entry.member_name) continue
    const member = memberParty(entry.member_user_id, entry.member_name)
    if (entry.kind === 'reimbursement') {
      // The Verein paid the member out.
      owe(pairs, VEREIN, member, -entry.amount_cents)
    } else if (entry.kind === 'income') {
      // The member paid into the Vereinskonto.
      owe(pairs, member, VEREIN, -entry.amount_cents)
    }
  }
  for (const p of memberPayments) {
    owe(
      pairs,
      memberParty(p.from_user_id, p.from_name),
      memberParty(p.to_user_id, p.to_name),
      -p.amount_cents,
    )
  }

  const balances = netPerParty(pairs)
  const debts = consolidateDebts(balances)
  const positionList: MemberPosition[] = balances
    .filter((b) => b.party.kind === 'member')
    .map((b) => ({
      user_id: b.party.user_id,
      name: b.party.name,
      net_cents: b.net_cents,
    }))
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
    debts,
    pending_count: pendingCount,
  }
}

/** What one party is owed (positive) or still has to pay (negative). */
export type PartyBalance = { party: DebtParty; net_cents: number }

/**
 * Rolls the pairwise obligations up into one net figure per party
 * (members and the Vereinskassa alike), dropping the settled ones.
 */
function netPerParty(pairs: Map<string, PairBalance>): PartyBalance[] {
  const nets = new Map<string, PartyBalance>()
  const bump = (party: DebtParty, delta: number) => {
    const key = partyKey(party)
    const existing = nets.get(key)
    if (existing) {
      existing.net_cents += delta
    } else {
      nets.set(key, { party, net_cents: delta })
    }
  }
  for (const pair of pairs.values()) {
    bump(pair.a, -pair.cents)
    bump(pair.b, pair.cents)
  }
  return [...nets.values()].filter((n) => n.net_cents !== 0)
}

/**
 * Turns net balances into the shortest list of payments that settles
 * them all: the biggest debtor pays the biggest creditor, repeatedly
 * (the classic greedy plan, at most one payment per party minus one).
 *
 * That deliberately ignores who owed whom originally — nobody should
 * hand money to someone who then has to pass it on. So a member may be
 * asked to pay someone they never shared a bill with, and the
 * Vereinskassa takes part like any other party: settling its share of
 * a member's claim directly leaves both the Kontostand and everyone's
 * net position correct.
 */
export function consolidateDebts(balances: PartyBalance[]): OutstandingDebt[] {
  // Largest amounts first, name as the tie-break so the plan is stable.
  const bySize = (a: PartyBalance, b: PartyBalance) =>
    Math.abs(b.net_cents) - Math.abs(a.net_cents) ||
    a.party.name.localeCompare(b.party.name)
  const debtors = balances
    .filter((b) => b.net_cents < 0)
    .sort(bySize)
    .map((b) => ({ party: b.party, open: -b.net_cents }))
  const creditors = balances
    .filter((b) => b.net_cents > 0)
    .sort(bySize)
    .map((b) => ({ party: b.party, open: b.net_cents }))

  const debts: OutstandingDebt[] = []
  let d = 0
  let c = 0
  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d]
    const creditor = creditors[c]
    if (!debtor || !creditor) break
    const amount = Math.min(debtor.open, creditor.open)
    if (amount > 0) {
      debts.push({
        from: debtor.party,
        to: creditor.party,
        amount_cents: amount,
      })
    }
    debtor.open -= amount
    creditor.open -= amount
    if (debtor.open === 0) d++
    if (creditor.open === 0) c++
  }

  return debts.sort(
    (x, y) =>
      x.from.name.localeCompare(y.from.name) ||
      y.amount_cents - x.amount_cents ||
      x.to.name.localeCompare(y.to.name),
  )
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
