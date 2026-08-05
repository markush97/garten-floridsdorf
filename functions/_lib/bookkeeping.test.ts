import { describe, expect, it } from 'vitest'
import {
  computeKassaOverview,
  computeSplitShares,
  consolidateDebts,
  type LedgerBankEntry,
  type LedgerExpense,
  type LedgerMemberPayment,
  type LedgerShare,
  type PartyBalance,
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
    paid_from: 'member',
    paid_by_user_id: 2,
    paid_by_name: 'Bert',
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

  const overview = computeKassaOverview(expenses, shares, bankEntries, [], 2)

  /** "Anna->Bert" → open amount, for readable pair assertions. */
  function pairs(result = overview): Map<string, number> {
    return new Map(
      result.debts.map((d) => [`${d.from.name}->${d.to.name}`, d.amount_cents]),
    )
  }

  it('computes the balance from bank entries minus Vereinskonto expenses', () => {
    // 200000 + 45000 − 8000 (reimbursement) − 12000 (only the Verein-paid bill)
    expect(overview.balance_cents).toBe(225000)
  })

  it('sums the total spend across all approved expenses', () => {
    expect(overview.total_expenses_cents).toBe(32000)
  })

  it('routes every open payment to the one member who is owed money', () => {
    // Bert is the only creditor (+7500), so everyone pays him — even the
    // Vereinskassa, which owes Anna 2000 of it.
    expect(pairs().get('Anna->Bert')).toBe(500)
    expect(pairs().get('Cara->Bert')).toBe(2500)
    expect(pairs().get('Dora->Bert')).toBe(2500)
    expect(pairs().get('Vereinskassa->Bert')).toBe(2000)
    expect(overview.debts).toHaveLength(4)
  })

  it('never asks anyone to pay themselves', () => {
    expect(overview.debts.filter((d) => d.from.name === d.to.name)).toEqual([])
  })

  it('sorts the open payments by debtor name', () => {
    expect(overview.debts.map((d) => d.from.name)).toEqual([
      'Anna',
      'Cara',
      'Dora',
      'Vereinskassa',
    ])
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

  it('orders positions so the largest amount to get back is first', () => {
    expect(overview.positions[0]?.name).toBe('Bert')
  })

  it('leaves the Vereinskassa out of the member positions', () => {
    expect(overview.positions.map((p) => p.name)).not.toContain('Vereinskassa')
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
      [],
      0,
    )
    expect(broke.balance_cents).toBe(-40000)
  })
})

describe('computeKassaOverview with selected cost bearers', () => {
  // Anna fronted 60,00 € for a project only Cara and Dora carry.
  const expense: LedgerExpense = {
    amount_cents: 6000,
    type: 'project',
    category: 'anbauflaeche',
    cadence: 'one_time',
    paid_from: 'member',
    paid_by_user_id: 1,
    paid_by_name: 'Anna',
    settlement: 'selected',
  }
  const shares: LedgerShare[] = [
    {
      user_id: 3,
      member_name: 'Cara',
      share_cents: 3000,
      paid_from: 'member',
      paid_by_user_id: 1,
      paid_by_name: 'Anna',
    },
    {
      user_id: 4,
      member_name: 'Dora',
      share_cents: 3000,
      paid_from: 'member',
      paid_by_user_id: 1,
      paid_by_name: 'Anna',
    },
  ]

  function run(payments: LedgerMemberPayment[]) {
    const result = computeKassaOverview([expense], shares, [], payments, 0)
    return {
      result,
      pairs: new Map(
        result.debts.map((d) => [
          `${d.from.name}->${d.to.name}`,
          d.amount_cents,
        ]),
      ),
    }
  }

  it('charges only the selected members, each towards the payer', () => {
    const { result, pairs } = run([])
    expect(pairs.get('Cara->Anna')).toBe(3000)
    expect(pairs.get('Dora->Anna')).toBe(3000)
    expect(result.debts).toHaveLength(2)
    const byName = new Map(result.positions.map((p) => [p.name, p.net_cents]))
    expect(byName.get('Anna')).toBe(6000)
    expect(byName.get('Bert')).toBeUndefined()
  })

  it('leaves the Vereinskonto balance untouched for a privately paid bill', () => {
    expect(run([]).result.balance_cents).toBe(0)
  })

  it('reduces a debt by a partial payback', () => {
    const { pairs } = run([
      {
        from_user_id: 3,
        from_name: 'Cara',
        to_user_id: 1,
        to_name: 'Anna',
        amount_cents: 1000,
      },
    ])
    expect(pairs.get('Cara->Anna')).toBe(2000)
  })

  it('drops a debt that was paid back in full', () => {
    const { result, pairs } = run([
      {
        from_user_id: 3,
        from_name: 'Cara',
        to_user_id: 1,
        to_name: 'Anna',
        amount_cents: 3000,
      },
    ])
    expect(pairs.get('Cara->Anna')).toBeUndefined()
    expect(result.debts).toHaveLength(1)
    const byName = new Map(result.positions.map((p) => [p.name, p.net_cents]))
    expect(byName.get('Cara')).toBeUndefined()
    expect(byName.get('Anna')).toBe(3000)
  })

  it('routes an overpayment onward instead of paying it back', () => {
    // Cara paid 4000 on a 3000 share, so she is owed 1000 — which Dora
    // (still owing 3000) settles directly. Anna gets the other 2000.
    const { result, pairs } = run([
      {
        from_user_id: 3,
        from_name: 'Cara',
        to_user_id: 1,
        to_name: 'Anna',
        amount_cents: 4000,
      },
    ])
    expect(pairs.get('Dora->Anna')).toBe(2000)
    expect(pairs.get('Dora->Cara')).toBe(1000)
    expect(result.debts).toHaveLength(2)
  })

  it('nets paybacks in both directions between the same two members', () => {
    const { pairs } = run([
      {
        from_user_id: 3,
        from_name: 'Cara',
        to_user_id: 1,
        to_name: 'Anna',
        amount_cents: 2500,
      },
      {
        from_user_id: 1,
        from_name: 'Anna',
        to_user_id: 3,
        to_name: 'Cara',
        amount_cents: 500,
      },
    ])
    expect(pairs.get('Cara->Anna')).toBe(1000)
    expect(pairs.get('Dora->Anna')).toBe(3000)
  })
})

describe('consolidateDebts', () => {
  function member(id: number, name: string, netCents: number): PartyBalance {
    return {
      party: { kind: 'member', user_id: id, name },
      net_cents: netCents,
    }
  }
  const verein = (netCents: number): PartyBalance => ({
    party: { kind: 'verein', user_id: null, name: 'Vereinskassa' },
    net_cents: netCents,
  })

  it('sends everyone to the single creditor', () => {
    // The real numbers from the Kassa overview: Markus fronted almost
    // everything, so three payments settle the whole club.
    const debts = consolidateDebts([
      member(1, 'Markus Hinkel', 120582),
      member(2, 'Thomas Hinkel', -10706),
      member(3, 'Doris Hinkel', -49170),
      member(4, 'Marlen Hinkel', -60706),
    ])
    expect(
      debts.map((d) => `${d.from.name} → ${d.to.name}: ${d.amount_cents}`),
    ).toEqual([
      'Doris Hinkel → Markus Hinkel: 49170',
      'Marlen Hinkel → Markus Hinkel: 60706',
      'Thomas Hinkel → Markus Hinkel: 10706',
    ])
  })

  it('needs at most one payment per party minus one', () => {
    const debts = consolidateDebts([
      member(1, 'Anna', 6000),
      member(2, 'Bert', 3000),
      member(3, 'Cara', -4000),
      member(4, 'Dora', -5000),
    ])
    expect(debts.length).toBeLessThanOrEqual(3)
    // Dora, the biggest debtor, clears the biggest creditor first; only
    // Cara has to split her payment across the two creditors. Rows are
    // listed per debtor, largest amount first.
    expect(debts).toEqual([
      {
        from: { kind: 'member', user_id: 3, name: 'Cara' },
        to: { kind: 'member', user_id: 2, name: 'Bert' },
        amount_cents: 3000,
      },
      {
        from: { kind: 'member', user_id: 3, name: 'Cara' },
        to: { kind: 'member', user_id: 1, name: 'Anna' },
        amount_cents: 1000,
      },
      {
        from: { kind: 'member', user_id: 4, name: 'Dora' },
        to: { kind: 'member', user_id: 1, name: 'Anna' },
        amount_cents: 5000,
      },
    ])
  })

  it('settles every net exactly', () => {
    const balances = [
      member(1, 'Anna', 7333),
      member(2, 'Bert', -2111),
      member(3, 'Cara', -1222),
      verein(-4000),
    ]
    const debts = consolidateDebts(balances)
    const settled = new Map<string, number>()
    for (const debt of debts) {
      settled.set(
        debt.from.name,
        (settled.get(debt.from.name) ?? 0) - debt.amount_cents,
      )
      settled.set(
        debt.to.name,
        (settled.get(debt.to.name) ?? 0) + debt.amount_cents,
      )
    }
    for (const balance of balances) {
      expect(settled.get(balance.party.name)).toBe(balance.net_cents)
    }
  })

  it('lets the Vereinskassa settle a claim directly', () => {
    const debts = consolidateDebts([member(1, 'Anna', 5000), verein(-5000)])
    expect(debts).toEqual([
      {
        from: { kind: 'verein', user_id: null, name: 'Vereinskassa' },
        to: { kind: 'member', user_id: 1, name: 'Anna' },
        amount_cents: 5000,
      },
    ])
  })

  it('returns nothing when everything is settled', () => {
    expect(consolidateDebts([])).toEqual([])
    expect(consolidateDebts([member(1, 'Anna', 0)])).toEqual([])
  })

  it('is stable for equal amounts', () => {
    const balances = [
      member(1, 'Anna', 2000),
      member(2, 'Bert', -1000),
      member(3, 'Cara', -1000),
    ]
    expect(consolidateDebts(balances)).toEqual(
      consolidateDebts([...balances].reverse()),
    )
  })
})
