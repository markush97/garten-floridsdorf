import { describe, expect, it } from 'vitest'
import {
  computeKassaOverview,
  computeSplitShares,
  type LedgerBankEntry,
  type LedgerExpense,
  type LedgerShare,
  type SplitMember,
} from './bookkeeping'

const members: SplitMember[] = [
  { user_id: 1, name: 'Anna' },
  { user_id: 2, name: 'Bert' },
  { user_id: 3, name: 'Cara' },
  { user_id: 4, name: 'Dora' },
]

describe('computeSplitShares', () => {
  it('splits an evenly divisible amount equally', () => {
    const shares = computeSplitShares(10000, members, 2)
    expect(shares.map((s) => s.share_cents)).toEqual([2500, 2500, 2500, 2500])
  })

  it('assigns the rounding remainder to the payer', () => {
    const shares = computeSplitShares(10000, members.slice(0, 3), 2)
    // 10000 / 3 = 3333 base, remainder 1 → payer (Bert, id 2) gets +1.
    const byId = new Map(shares.map((s) => [s.user_id, s.share_cents]))
    expect(byId.get(1)).toBe(3333)
    expect(byId.get(2)).toBe(3334)
    expect(byId.get(3)).toBe(3333)
    expect(shares.reduce((a, s) => a + s.share_cents, 0)).toBe(10000)
  })

  it('assigns the remainder to the first member when the payer is not in the pool', () => {
    const shares = computeSplitShares(10000, members.slice(0, 3), null)
    expect(shares.map((s) => s.share_cents)).toEqual([3334, 3333, 3333])
    expect(shares.reduce((a, s) => a + s.share_cents, 0)).toBe(10000)
  })

  it('returns nothing for an empty member pool', () => {
    expect(computeSplitShares(10000, [], 1)).toEqual([])
  })
})

describe('computeKassaOverview', () => {
  const expenses: LedgerExpense[] = [
    {
      amount_cents: 12000,
      type: 'expected',
      category: 'betriebskosten',
      cadence: 'regular',
      paid_from: 'verein',
      paid_by_user_id: null,
      paid_by_name: null,
      settlement: 'verein',
    },
    {
      amount_cents: 10000,
      type: 'emergency',
      category: 'huetten',
      cadence: 'one_time',
      paid_from: 'member',
      paid_by_user_id: 1,
      paid_by_name: 'Anna',
      settlement: 'verein',
    },
    {
      amount_cents: 10000,
      type: 'project',
      category: 'huetten',
      cadence: 'one_time',
      paid_from: 'member',
      paid_by_user_id: 2,
      paid_by_name: 'Bert',
      settlement: 'split',
    },
  ]
  // Shares materialized for the split expense (Bert paid, all four share).
  const shares: LedgerShare[] = members.map((m) => ({
    user_id: m.user_id,
    member_name: m.name,
    share_cents: 2500,
  }))
  const bankEntries: LedgerBankEntry[] = [
    {
      kind: 'opening',
      amount_cents: 200000,
      member_user_id: null,
      member_name: null,
    },
    {
      kind: 'income',
      amount_cents: 45000,
      member_user_id: null,
      member_name: null,
    },
    {
      kind: 'reimbursement',
      amount_cents: 8000,
      member_user_id: 1,
      member_name: 'Anna',
    },
  ]

  const overview = computeKassaOverview(expenses, shares, bankEntries, 2)

  it('computes the balance from bank entries minus Vereinskonto expenses', () => {
    // 200000 + 45000 − 8000 (reimbursement) − 12000 (only the Verein-paid bill)
    expect(overview.balance_cents).toBe(225000)
  })

  it('sums the total spend across all approved expenses', () => {
    expect(overview.total_expenses_cents).toBe(32000)
  })

  it('computes each member net position (payer-included split)', () => {
    const byName = new Map(overview.positions.map((p) => [p.name, p.net_cents]))
    // Anna: +10000 fronted − 2500 share − 8000 reimbursed = −500
    expect(byName.get('Anna')).toBe(-500)
    // Bert: +10000 fronted − 2500 own share = +7500 (Verein owes Bert)
    expect(byName.get('Bert')).toBe(7500)
    // Cara / Dora: only their −2500 share
    expect(byName.get('Cara')).toBe(-2500)
    expect(byName.get('Dora')).toBe(-2500)
  })

  it('orders positions so the largest amount owed by the Verein is first', () => {
    expect(overview.positions[0]?.name).toBe('Bert')
  })

  it('groups spend by category, type and cadence in enum order, dropping empties', () => {
    expect(overview.by_category).toEqual([
      { key: 'huetten', label: 'Hütten', total_cents: 20000 },
      { key: 'betriebskosten', label: 'Betriebskosten', total_cents: 12000 },
    ])
    expect(overview.by_type).toEqual([
      { key: 'expected', label: 'Erwartet', total_cents: 12000 },
      { key: 'emergency', label: 'Notfall', total_cents: 10000 },
      { key: 'project', label: 'Projekt', total_cents: 10000 },
    ])
    expect(overview.by_cadence).toEqual([
      { key: 'regular', label: 'Regelmäßig', total_cents: 12000 },
      { key: 'one_time', label: 'Einmalig', total_cents: 20000 },
    ])
  })

  it('passes the pending count through', () => {
    expect(overview.pending_count).toBe(2)
  })

  it('can report a negative balance', () => {
    const broke = computeKassaOverview(
      [
        {
          amount_cents: 50000,
          type: 'emergency',
          category: 'sonstiges',
          cadence: 'one_time',
          paid_from: 'verein',
          paid_by_user_id: null,
          paid_by_name: null,
          settlement: 'verein',
        },
      ],
      [],
      [
        {
          kind: 'opening',
          amount_cents: 10000,
          member_user_id: null,
          member_name: null,
        },
      ],
      0,
    )
    expect(broke.balance_cents).toBe(-40000)
  })
})
