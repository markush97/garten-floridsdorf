import { describe, expect, it } from 'vitest'
import {
  bankEntryConsistencyIssue,
  createBankEntryInputSchema,
  createExpenseInputSchema,
  expenseConsistencyIssue,
} from '../contracts/bookkeeping'

const validExpense = {
  description: 'Rasenmäher-Reparatur',
  amount_cents: 4990,
  expense_date: '2026-07-01',
  type: 'expected' as const,
  category: 'rasenflaeche' as const,
  cadence: 'one_time' as const,
  paid_from: 'verein' as const,
  settlement: 'verein' as const,
}

describe('createExpenseInputSchema', () => {
  it('accepts a valid Verein-paid bill', () => {
    expect(createExpenseInputSchema.safeParse(validExpense).success).toBe(true)
  })

  it('trims the description and rejects an empty one', () => {
    expect(
      createExpenseInputSchema.safeParse({
        ...validExpense,
        description: '   ',
      }).success,
    ).toBe(false)
  })

  it('rejects a zero or non-integer amount', () => {
    expect(
      createExpenseInputSchema.safeParse({ ...validExpense, amount_cents: 0 })
        .success,
    ).toBe(false)
    expect(
      createExpenseInputSchema.safeParse({ ...validExpense, amount_cents: 4.5 })
        .success,
    ).toBe(false)
  })

  it('rejects a malformed date', () => {
    expect(
      createExpenseInputSchema.safeParse({
        ...validExpense,
        expense_date: '01.07.2026',
      }).success,
    ).toBe(false)
  })

  it('requires a payer when paid privately', () => {
    const withoutPayer = createExpenseInputSchema.safeParse({
      ...validExpense,
      paid_from: 'member',
    })
    expect(withoutPayer.success).toBe(false)
    const withPayer = createExpenseInputSchema.safeParse({
      ...validExpense,
      paid_from: 'member',
      paid_by_user_id: 3,
    })
    expect(withPayer.success).toBe(true)
  })

  it('requires a project name for project-type bills', () => {
    const withoutName = createExpenseInputSchema.safeParse({
      ...validExpense,
      type: 'project',
    })
    expect(withoutName.success).toBe(false)
    const withName = createExpenseInputSchema.safeParse({
      ...validExpense,
      type: 'project',
      project_name: 'Neuer Zaun',
    })
    expect(withName.success).toBe(true)
  })
})

describe('expenseConsistencyIssue', () => {
  it('flags a private payment without a payer', () => {
    expect(
      expenseConsistencyIssue({
        type: 'expected',
        paid_from: 'member',
        paid_by_user_id: null,
        project_name: null,
      }),
    ).toMatch(/Mitglied/)
  })

  it('flags a project bill without a project name', () => {
    expect(
      expenseConsistencyIssue({
        type: 'project',
        paid_from: 'verein',
        paid_by_user_id: null,
        project_name: null,
      }),
    ).toMatch(/Projekt/)
  })

  it('passes a consistent bill', () => {
    expect(
      expenseConsistencyIssue({
        type: 'expected',
        paid_from: 'verein',
        paid_by_user_id: null,
        project_name: null,
      }),
    ).toBeNull()
  })
})

describe('createBankEntryInputSchema', () => {
  const base = {
    kind: 'income' as const,
    amount_cents: 45000,
    entry_date: '2026-07-01',
  }

  it('accepts an income without a member', () => {
    expect(createBankEntryInputSchema.safeParse(base).success).toBe(true)
  })

  it('requires a member for a reimbursement', () => {
    expect(
      createBankEntryInputSchema.safeParse({ ...base, kind: 'reimbursement' })
        .success,
    ).toBe(false)
    expect(
      createBankEntryInputSchema.safeParse({
        ...base,
        kind: 'reimbursement',
        member_user_id: 2,
      }).success,
    ).toBe(true)
  })
})

describe('bankEntryConsistencyIssue', () => {
  it('flags a reimbursement without a member', () => {
    expect(
      bankEntryConsistencyIssue({
        kind: 'reimbursement',
        member_user_id: null,
      }),
    ).toMatch(/Mitglied/)
  })

  it('passes an opening balance', () => {
    expect(
      bankEntryConsistencyIssue({ kind: 'opening', member_user_id: null }),
    ).toBeNull()
  })
})
