'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BarChart3, Receipt, Wallet } from 'lucide-react'
import RevenueTab from '@/components/accounting/revenue-tab'
import ExpensesTab from '@/components/accounting/expenses-tab'
import CompensationTab from '@/components/accounting/compensation-tab'
import { useFinanceSettings } from '@/hooks/use-finance-settings'

export default function AccountingPage() {
  const [tab, setTab] = useState('revenue')
  const [year] = useState(() => new Date().getFullYear())

  // Les paramètres financiers sont détenus ici : les onglets Charges et
  // Ma rémunération en éditent des champs différents, et l'enregistrement
  // réécrit toute la ligne. Un état unique évite qu'ils s'écrasent.
  const finance = useFinanceSettings()

  // Recalcule la simulation après une modification des charges.
  const [expensesRevision, setExpensesRevision] = useState(0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Comptabilité</h1>
        <p className="text-muted-foreground">
          Vos recettes, vos charges, et ce que vous pouvez réellement vous verser
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="revenue" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Recettes</span>
          </TabsTrigger>
          <TabsTrigger value="expenses" className="gap-2">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Charges</span>
          </TabsTrigger>
          <TabsTrigger value="compensation" className="gap-2">
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">Ma rémunération</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="mt-6">
          <RevenueTab />
        </TabsContent>

        <TabsContent value="expenses" className="mt-6">
          <ExpensesTab
            year={year}
            finance={finance}
            onChanged={() => setExpensesRevision((value) => value + 1)}
          />
        </TabsContent>

        <TabsContent value="compensation" className="mt-6">
          <CompensationTab key={expensesRevision} year={year} finance={finance} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
