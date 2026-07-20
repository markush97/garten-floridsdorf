import { Navigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useMe } from '~/services/auth.service'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/ui/tabs'
import type { SessionUser } from '~func/contracts/auth'
import BankEntriesPanel from './BankEntriesPanel'
import BudgetOverview from './BudgetOverview'
import ExpenseSection from './ExpenseSection'
import MemberShell from './MemberShell'

export default function KassaPage() {
  const { data: me, isPending, isError } = useMe()

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f8f3e7_0%,#f2ecdc_100%)] text-sm text-forest-700/60">
        Wird geladen …
      </div>
    )
  }
  if (isError || !me) {
    return <Navigate to="/login" />
  }
  return (
    <MemberShell me={me}>
      <KassaContent me={me} />
    </MemberShell>
  )
}

function KassaContent({ me }: { me: SessionUser }) {
  const [tab, setTab] = useState('overview')

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl text-forest-900">Kassa</h1>
        <p className="text-sm text-forest-700/70">
          Rechnungen hochladen, Budget im Blick behalten und offene Auslagen
          verfolgen.
        </p>
      </div>

      <Tabs onValueChange={setTab} value={tab}>
        <TabsList>
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="expenses">Rechnungen</TabsTrigger>
          {me.is_kassier && (
            <TabsTrigger value="admin">Kassa-Verwaltung</TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="overview">
          <BudgetOverview />
        </TabsContent>
        <TabsContent value="expenses">
          <ExpenseSection me={me} />
        </TabsContent>
        {me.is_kassier && (
          <TabsContent value="admin">
            <BankEntriesPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
