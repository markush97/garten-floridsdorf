import { useState } from 'react'
import { formatEuro } from '~/lib/money'
import { cn } from '~/lib/ui-utils'
import {
  useKassaMembers,
  useKassaOverview,
} from '~/services/bookkeeping.service'
import { Card, CardContent, CardHeader, CardTitle } from '~/ui/card'
import type { SessionUser } from '~func/contracts/auth'
import type {
  DebtParty,
  GroupTotal,
  MemberPosition,
  OutstandingDebt,
} from '~func/contracts/bookkeeping'
import type { MemberPaymentPrefill } from './MemberPaymentsPanel'
import { MemberPaymentDialog } from './MemberPaymentsPanel'

export default function BudgetOverview({ me }: { me: SessionUser }) {
  const { data, isPending, isError } = useKassaOverview()
  const { data: members = [] } = useKassaMembers()
  const [prefill, setPrefill] = useState<MemberPaymentPrefill | null>(null)

  if (isPending) {
    return (
      <p className="py-8 text-center text-sm text-forest-700/60">
        Wird geladen …
      </p>
    )
  }
  if (isError || !data) {
    return (
      <p className="py-8 text-center text-sm text-beet-700">
        Die Übersicht konnte nicht geladen werden.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kontostand Vereinskonto</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={cn(
                'font-heading text-3xl',
                data.balance_cents < 0 ? 'text-beet-700' : 'text-forest-900',
              )}
            >
              {formatEuro(data.balance_cents)}
            </p>
            <p className="mt-1 text-xs text-forest-700/60">
              Anfangsbestand + Einnahmen − vom Konto bezahlte Rechnungen −
              Rückzahlungen.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ausgaben gesamt (freigegeben)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-3xl text-forest-900">
              {formatEuro(data.total_expenses_cents)}
            </p>
            <p className="mt-1 text-xs text-forest-700/60">
              {data.pending_count > 0
                ? `${data.pending_count} Rechnung(en) warten auf Freigabe.`
                : 'Keine offenen Rechnungen.'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GroupCard groups={data.by_category} title="Nach Kategorie" />
        <GroupCard groups={data.by_type} title="Nach Art" />
        <GroupCard groups={data.by_cadence} title="Nach Häufigkeit" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DebtsCard debts={data.debts} me={me} onSettle={setPrefill} />
        <PositionsCard positions={data.positions} />
      </div>

      <MemberPaymentDialog
        editing={null}
        members={members}
        onOpenChange={(open) => {
          if (!open) setPrefill(null)
        }}
        open={prefill !== null}
        prefill={prefill}
      />
    </div>
  )
}

function GroupCard({ title, groups }: { title: string; groups: GroupTotal[] }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className="text-sm text-forest-700/60">Keine Ausgaben.</p>
        ) : (
          <ul className="space-y-1.5">
            {groups.map((g) => (
              <li
                className="flex items-center justify-between gap-3"
                key={g.key}
              >
                <span className="text-forest-700">{g.label}</span>
                <span className="font-medium tabular-nums text-forest-900">
                  {formatEuro(g.total_cents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/** Stable key for a debt party, mirroring the server-side ledger key. */
function partyKey(party: DebtParty): string {
  if (party.kind === 'verein') return 'verein'
  return party.user_id == null ? `name:${party.name}` : `id:${party.user_id}`
}

/** Groups the flat debt list per debtor, keeping the server's name order. */
function groupByDebtor(
  debts: OutstandingDebt[],
): { from: DebtParty; rows: OutstandingDebt[]; total_cents: number }[] {
  const groups = new Map<
    string,
    { from: DebtParty; rows: OutstandingDebt[]; total_cents: number }
  >()
  for (const debt of debts) {
    const key = partyKey(debt.from)
    const group = groups.get(key)
    if (group) {
      group.rows.push(debt)
      group.total_cents += debt.amount_cents
    } else {
      groups.set(key, {
        from: debt.from,
        rows: [debt],
        total_cents: debt.amount_cents,
      })
    }
  }
  return [...groups.values()]
}

/**
 * Who still has to pay whom, netted per pair. A payback between two
 * members can be recorded straight from the row — a member may only do
 * that for their own debts, a Kassier for any.
 */
function DebtsCard({
  debts,
  me,
  onSettle,
}: {
  debts: OutstandingDebt[]
  me: SessionUser
  onSettle: (prefill: MemberPaymentPrefill) => void
}) {
  const groups = groupByDebtor(debts)

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Offene Zahlungen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {groups.length === 0 ? (
          <p className="text-sm text-forest-700/60">Nichts offen.</p>
        ) : (
          <ul className="space-y-3">
            {groups.map((group) => (
              <li className="space-y-1.5" key={partyKey(group.from)}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-forest-900">
                    {group.from.name} zahlt
                  </span>
                  <span className="text-sm font-medium tabular-nums text-beet-700">
                    {formatEuro(group.total_cents)}
                  </span>
                </div>
                <ul className="space-y-1 border-l border-forest-900/10 pl-3">
                  {group.rows.map((debt) => (
                    <li
                      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
                      key={partyKey(debt.to)}
                    >
                      <span className="text-sm text-forest-700">
                        an {debt.to.name}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-sm tabular-nums text-forest-900">
                          {formatEuro(debt.amount_cents)}
                        </span>
                        {canSettle(me, debt) && (
                          <button
                            className="rounded-full px-2 py-0.5 text-xs text-forest-700 underline decoration-forest-700/30 underline-offset-2 hover:decoration-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30 focus-visible:outline-none"
                            onClick={() =>
                              onSettle({
                                // Non-null: `canSettle` requires both ids.
                                from_user_id: debt.from.user_id as number,
                                to_user_id: debt.to.user_id as number,
                                amount_cents: debt.amount_cents,
                              })
                            }
                            type="button"
                          >
                            Rückzahlung erfassen
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-forest-700/55">
          Anteile an Rechnungen, die jemand ausgelegt hat, verrechnet mit
          bereits erfassten Rückzahlungen.
        </p>
      </CardContent>
    </Card>
  )
}

/**
 * Whether the session may record this debt as paid back: it must run
 * between two current members, and a member may only settle debts they
 * are part of.
 */
function canSettle(me: SessionUser, debt: OutstandingDebt): boolean {
  if (debt.from.user_id === null || debt.to.user_id === null) return false
  if (debt.from.kind !== 'member' || debt.to.kind !== 'member') return false
  if (me.is_kassier) return true
  return me.user_id === debt.from.user_id || me.user_id === debt.to.user_id
}

/** Each member's net across the Vereinskassa and all other members. */
function PositionsCard({ positions }: { positions: MemberPosition[] }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Saldo pro Mitglied</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {positions.length === 0 ? (
          <p className="text-sm text-forest-700/60">Alles ausgeglichen.</p>
        ) : (
          <ul className="space-y-1.5">
            {positions.map((p) => (
              <li
                className="flex items-center justify-between gap-3"
                key={`${p.user_id ?? 'x'}-${p.name}`}
              >
                <span className="text-forest-700">{p.name}</span>
                <span
                  className={cn(
                    'font-medium tabular-nums',
                    p.net_cents > 0 ? 'text-forest-900' : 'text-beet-700',
                  )}
                >
                  {p.net_cents > 0 ? 'bekommt ' : 'zahlt '}
                  {formatEuro(Math.abs(p.net_cents))}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-forest-700/55">
          Verauslagte Beträge minus eigene Kostenanteile, über alle
          Gegenparteien hinweg.
        </p>
      </CardContent>
    </Card>
  )
}
