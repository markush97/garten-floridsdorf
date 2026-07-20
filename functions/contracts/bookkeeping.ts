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
export const SETTLEMENT = ['verein', 'split'] as const
export type Settlement = (typeof SETTLEMENT)[number]
export const SETTLEMENT_LABELS: Record<Settlement, string> = {
  verein: 'Vereinskassa trägt',
  split: 'Auf alle aufgeteilt',
}

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
}): string | null {
  if (v.paid_from === 'member' && v.paid_by_user_id == null) {
    return 'Bitte angeben, welches Mitglied bezahlt hat.'
  }
  if (v.type === 'project' && !v.project_name) {
    return 'Bitte das Projekt benennen.'
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
}

export const createExpenseInputSchema = z
  .object(expenseFields)
  .superRefine((v, ctx) => {
    const issue = expenseConsistencyIssue({
      type: v.type,
      paid_from: v.paid_from,
      paid_by_user_id: v.paid_by_user_id ?? null,
      project_name: v.project_name ?? null,
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

export type CreateExpenseInput = z.infer<typeof createExpenseInputSchema>
export type UpdateExpenseInput = z.infer<typeof updateExpenseInputSchema>
export type RejectExpenseInput = z.infer<typeof rejectExpenseInputSchema>
export type CreateBankEntryInput = z.infer<typeof createBankEntryInputSchema>
export type UpdateBankEntryInput = z.infer<typeof updateBankEntryInputSchema>

// ── Response shapes ──────────────────────────────────────────────────────────

/** A member option for the payer / reimbursement pickers. */
export type KassaMember = {
  user_id: number
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

/** A grouped total for the budget viewer (by category / type / cadence). */
export type GroupTotal = {
  key: string
  label: string
  total_cents: number
}

/**
 * A member's net position. `net_cents > 0` means the Verein owes the
 * member (they lent money); `< 0` means the member owes the Verein
 * (their share of split costs).
 */
export type MemberPosition = {
  user_id: number | null
  name: string
  net_cents: number
}

/** Payload of `GET /kassa/overview` — the budget viewer. */
export type KassaOverview = {
  balance_cents: number
  total_expenses_cents: number
  by_category: GroupTotal[]
  by_type: GroupTotal[]
  by_cadence: GroupTotal[]
  positions: MemberPosition[]
  pending_count: number
}
