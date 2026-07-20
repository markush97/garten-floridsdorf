import { formatEuro } from '~/lib/money'
import { cn } from '~/lib/ui-utils'
import { useKassaOverview } from '~/services/bookkeeping.service'
import { Card, CardContent, CardHeader, CardTitle } from '~/ui/card'
import type { GroupTotal, MemberPosition } from '~func/contracts/bookkeeping'

export default function BudgetOverview() {
  const { data, isPending, isError } = useKassaOverview()

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

  const owedTo = data.positions.filter((p) => p.net_cents > 0)
  const oweVerein = data.positions.filter((p) => p.net_cents < 0)

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
        <GroupCard title="Nach Kategorie" groups={data.by_category} />
        <GroupCard title="Nach Art" groups={data.by_type} />
        <GroupCard title="Nach Häufigkeit" groups={data.by_cadence} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PositionCard
          title="Verein schuldet"
          hint="Diese Mitglieder haben dem Verein Geld vorgestreckt."
          positions={owedTo}
          tone="owed"
        />
        <PositionCard
          title="Schulden an den Verein"
          hint="Anteile an aufgeteilten Kosten, die noch offen sind."
          positions={oweVerein}
          tone="owes"
        />
      </div>
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

function PositionCard({
  title,
  hint,
  positions,
  tone,
}: {
  title: string
  hint: string
  positions: MemberPosition[]
  tone: 'owed' | 'owes'
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {positions.length === 0 ? (
          <p className="text-sm text-forest-700/60">Nichts offen.</p>
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
                    tone === 'owed' ? 'text-forest-900' : 'text-beet-700',
                  )}
                >
                  {formatEuro(Math.abs(p.net_cents))}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-forest-700/55">{hint}</p>
      </CardContent>
    </Card>
  )
}
