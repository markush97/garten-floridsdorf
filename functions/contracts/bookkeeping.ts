import { z } from 'zod'
import { isoDateSchema } from './calendar'

// ── Enumerations + German labels ─────────────────────────────────────────────
// The `*_LABELS` maps are the single source of truth for the German UI text so
// the client and the server never drift apart.

/** Nature of the cost: "Was it expected, an emergency, or part of a project?" */
export const EXPENSE_TYPES = ['expected', 'emergency', 'project'] as const
export type ExpenseType = (typeof EXPENSE_TYPES)[number]
export const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  expected: 'Erwartet',
  emergency: 'Notfall',
  project: 'Projekt',
}

/** Fixed category set for now (may become configurable later). */
export const EXPENSE_CATEGORIES = [
  'huetten',
  'rasenflaeche',
  'anbauflaeche',
  'wildflaeche',
  'betriebskosten',
  'sonstiges',
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  huetten: 'Hütten',
  rasenflaeche: 'Rasenfläche',
  anbauflaeche: 'Anbaufläche',
  wildflaeche: 'Wildfläche',
  betriebskosten: 'Betriebskosten',
  sonstiges: 'Sonstiges',
}

/** Whether the cost recurs or is a one-off. */
export const EXPENSE_CADENCES = ['regular', 'one_time'] as const
export type ExpenseCadence = (typeof EXPENSE_CADENCES)[number]
export const EXPENSE_CADENCE_LABELS: Record<ExpenseCadence, string> = {
  regular: 'Regelmäßig',
  one_time: 'Einmalig',
}

/** Who actually paid the bill. */
export const PAID_FROM = ['verein', 'member'] as const
export type PaidFrom = (typeof PAID_FROM)[number]
export const PAID_FROM_LABELS: Record<PaidFrom, string> = {
  verein: 'Vereinskonto',
  member: 'Privat verauslagt',
}

/** Who should ultimately bear the cost. */
export const SETTLEMENT = ['verein', 'split', 'selected'] as const
export type Settlement = (typeof SETTLEMENT)[number]
export const SETTLEMENT_LABELS: Record<Settlement, string> = {
  verein: 'Vereinskassa trägt',
  split: 'Auf alle aufgeteilt',
  selected: 'Auf ausgewählte Mitglieder',
}

/** Display name of the Vereinskassa as a party in the debt ledger. */
export const VEREIN_PARTY_NAME = 'Vereinskassa'

export const EXPENSE_STATUSES = ['pending', 'approved', 'rejected'] as const
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number]
export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  pending: 'Offen',
  approved: 'Freigegeben',
  rejected: 'Abgelehnt',
}

/** Kind of manual Vereinskonto movement. */
export const BANK_ENTRY_KINDS = ['opening', 'income', 'reimbursement'] as const
export type BankEntryKind = (typeof BANK_ENTRY_KINDS)[number]
export const BANK_ENTRY_KIND_LABELS: Record<BankEntryKind, string> = {
  opening: 'Anfangsbestand',
  income: 'Einnahme',
  reimbursement: 'Auslagen-Rückzahlung',
}

// ── Shared field schemas ─────────────────────────────────────────────────────

// Euro amount as integer cents. Client converts euros → cents before sending.
// Cap at 100 million cents (1.000.000 €) as a sanity limit.
export const amountCentsSchema = z
  .number()
  .int('Bitte einen gültigen Betrag angeben.')
  .min(1, 'Der Betrag muss größer als 0 sein.')
  .max(100_000_000, 'Der Betrag ist zu groß.')

const optionalShortText = z
  .preprocess(
    (v) => (v == null ? '' : v),
    z
      .string()
      .max(500)
      .transform((v) => v.trim())
      .transform((v) => (v.length === 0 ? null : v)),
  )
  .nullish()

const memberIdSchema = z.number().int().positive().nullish()

/**
 * The members that bear the cost of a `settlement = 'selected'` bill.
 * Duplicates are dropped so the equal split can't be skewed by
 * sending the same member twice.
 */
const debtorIdsSchema = z
  .array(z.number().int().positive())
  .max(500, 'Zu viele Mitglieder ausgewählt.')
  .transform((ids) => [...new Set(ids)])
  .optional()

// ── Expense (bill) input ─────────────────────────────────────────────────────

/**
 * Cross-field consistency for an expense, exported as a pure function
 * so the query layer can re-check MERGED values on PATCH (the zod
 * schema only sees the fields present in the request). Returns a
 * German message or null.
 */
export function expenseConsistencyIssue(v: {
  type: ExpenseType
  paid_from: PaidFrom
  paid_by_user_id: number | null
  project_name: string | null
  settlement: Settlement
  debtor_count: number
}): string | null {
  if (v.paid_from === 'member' && v.paid_by_user_id == null) {
    return 'Bitte angeben, welches Mitglied bezahlt hat.'
  }
  if (v.type === 'project' && !v.project_name) {
    return 'Bitte das Projekt benennen.'
  }
  if (v.settlement === 'selected' && v.debtor_count === 0) {
    return 'Bitte mindestens ein Mitglied auswählen, das die Kosten trägt.'
  }
  return null
}

const expenseFields = {
  description: z
    .string()
    .trim()
    .min(1, 'Bitte angeben, was gekauft wurde.')
    .max(500),
  amount_cents: amountCentsSchema,
  expense_date: isoDateSchema,
  type: z.enum(EXPENSE_TYPES),
  category: z.enum(EXPENSE_CATEGORIES),
  cadence: z.enum(EXPENSE_CADENCES),
  project_name: optionalShortText,
  paid_from: z.enum(PAID_FROM),
  paid_by_user_id: memberIdSchema,
  settlement: z.enum(SETTLEMENT),
  debtor_user_ids: debtorIdsSchema,
}

export const createExpenseInputSchema = z
  .object(expenseFields)
  .superRefine((v, ctx) => {
    const issue = expenseConsistencyIssue({
      type: v.type,
      paid_from: v.paid_from,
      paid_by_user_id: v.paid_by_user_id ?? null,
      project_name: v.project_name ?? null,
      settlement: v.settlement,
      debtor_count: v.debtor_user_ids?.length ?? 0,
    })
    if (issue) ctx.addIssue({ code: 'custom', message: issue })
  })

// The consistency rule is re-checked on the merged row in the query
// layer, so the update schema only validates field shapes.
export const updateExpenseInputSchema = z.object({
  description: z.string().trim().min(1).max(500).optional(),
  amount_cents: amountCentsSchema.optional(),
  expense_date: isoDateSchema.optional(),
  type: z.enum(EXPENSE_TYPES).optional(),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  cadence: z.enum(EXPENSE_CADENCES).optional(),
  project_name: optionalShortText,
  paid_from: z.enum(PAID_FROM).optional(),
  paid_by_user_id: memberIdSchema,
  settlement: z.enum(SETTLEMENT).optional(),
  debtor_user_ids: debtorIdsSchema,
})

export const rejectExpenseInputSchema = z.object({
  note: optionalShortText,
})

// ── Bank entry input ─────────────────────────────────────────────────────────

export function bankEntryConsistencyIssue(v: {
  kind: BankEntryKind
  member_user_id: number | null
}): string | null {
  if (v.kind === 'reimbursement' && v.member_user_id == null) {
    return 'Bitte das Mitglied angeben, an das ausgezahlt wurde.'
  }
  return null
}

export const createBankEntryInputSchema = z
  .object({
    kind: z.enum(BANK_ENTRY_KINDS),
    amount_cents: amountCentsSchema,
    entry_date: isoDateSchema,
    description: optionalShortText,
    member_user_id: memberIdSchema,
  })
  .superRefine((v, ctx) => {
    const issue = bankEntryConsistencyIssue({
      kind: v.kind,
      member_user_id: v.member_user_id ?? null,
    })
    if (issue) ctx.addIssue({ code: 'custom', message: issue })
  })

export const updateBankEntryInputSchema = z.object({
  kind: z.enum(BANK_ENTRY_KINDS).optional(),
  amount_cents: amountCentsSchema.optional(),
  entry_date: isoDateSchema.optional(),
  description: optionalShortText,
  member_user_id: memberIdSchema,
})

// ── Member payment input (member pays another member back) ───────────────────

export function memberPaymentConsistencyIssue(v: {
  from_user_id: number
  to_user_id: number
}): string | null {
  if (v.from_user_id === v.to_user_id) {
    return 'Ein Mitglied kann nicht an sich selbst zurückzahlen.'
  }
  return null
}

export const createMemberPaymentInputSchema = z
  .object({
    from_user_id: z.number().int().positive(),
    to_user_id: z.number().int().positive(),
    amount_cents: amountCentsSchema,
    payment_date: isoDateSchema,
    description: optionalShortText,
  })
  .superRefine((v, ctx) => {
    const issue = memberPaymentConsistencyIssue(v)
    if (issue) ctx.addIssue({ code: 'custom', message: issue })
  })

// Re-checked on the merged row in the query layer, like the expense update.
export const updateMemberPaymentInputSchema = z.object({
  from_user_id: z.number().int().positive().optional(),
  to_user_id: z.number().int().positive().optional(),
  amount_cents: amountCentsSchema.optional(),
  payment_date: isoDateSchema.optional(),
  description: optionalShortText,
})

export type CreateExpenseInput = z.infer<typeof createExpenseInputSchema>
export type UpdateExpenseInput = z.infer<typeof updateExpenseInputSchema>
export type RejectExpenseInput = z.infer<typeof rejectExpenseInputSchema>
export type CreateBankEntryInput = z.infer<typeof createBankEntryInputSchema>
export type UpdateBankEntryInput = z.infer<typeof updateBankEntryInputSchema>
export type CreateMemberPaymentInput = z.infer<
  typeof createMemberPaymentInputSchema
>
export type UpdateMemberPaymentInput = z.infer<
  typeof updateMemberPaymentInputSchema
>

// ── Response shapes ──────────────────────────────────────────────────────────

/** A member option for the payer / reimbursement pickers. */
export type KassaMember = {
  user_id: number
  name: string
}

/**
 * A member picked to bear part of a `settlement = 'selected'` bill.
 * `user_id` is null once the account was deleted (the name snapshot
 * keeps the row readable).
 */
export type ExpenseDebtor = {
  user_id: number | null
  name: string
}

/** One row in an expense list. `has_receipt` avoids leaking the R2 key. */
export type ExpenseSummary = {
  id: number
  description: string
  amount_cents: number
  expense_date: string
  type: ExpenseType
  category: ExpenseCategory
  cadence: ExpenseCadence
  project_name: string | null
  paid_from: PaidFrom
  paid_by_user_id: number | null
  paid_by_name: string | null
  settlement: Settlement
  /** Only filled for `settlement = 'selected'`; empty otherwise. */
  debtors: ExpenseDebtor[]
  status: ExpenseStatus
  has_receipt: boolean
  receipt_filename: string | null
  submitted_by_user_id: number | null
  submitted_by_name: string
  reviewed_by_name: string | null
  reviewed_at: string | null
  review_note: string | null
  created_at: string
  updated_at: string
}

export type BankEntrySummary = {
  id: number
  kind: BankEntryKind
  amount_cents: number
  entry_date: string
  description: string | null
  member_user_id: number | null
  member_name: string | null
  recorded_by_name: string
  created_at: string
}

/** One recorded payback from one member to another. */
export type MemberPaymentSummary = {
  id: number
  from_user_id: number | null
  from_name: string
  to_user_id: number | null
  to_name: string
  amount_cents: number
  payment_date: string
  description: string | null
  recorded_by_user_id: number | null
  recorded_by_name: string
  created_at: string
}

/** A grouped total for the budget viewer (by category / type / cadence). */
export type GroupTotal = {
  key: string
  label: string
  total_cents: number
}

/**
 * A member's net position across all counterparties (the Vereinskassa
 * and other members). `net_cents > 0` means the member gets money back
 * (they lent more than they owe); `< 0` means they still have to pay.
 */
export type MemberPosition = {
  user_id: number | null
  name: string
  net_cents: number
}

/**
 * One side of an open payment. The Vereinskassa is a party of its own;
 * for a member `user_id` is null once the account was deleted.
 */
export type DebtParty = {
  kind: 'verein' | 'member'
  user_id: number | null
  name: string
}

/**
 * An open payment between two parties, netted per pair: `from` still
 * owes `to` this (always positive) amount.
 */
export type OutstandingDebt = {
  from: DebtParty
  to: DebtParty
  amount_cents: number
}

/** Payload of `GET /kassa/overview` — the budget viewer. */
export type KassaOverview = {
  balance_cents: number
  total_expenses_cents: number
  by_category: GroupTotal[]
  by_type: GroupTotal[]
  by_cadence: GroupTotal[]
  positions: MemberPosition[]
  /** Sorted by debtor name, then by descending amount. */
  debts: OutstandingDebt[]
  pending_count: number
}
