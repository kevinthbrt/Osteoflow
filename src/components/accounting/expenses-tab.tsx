'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Receipt,
  TrendingDown,
  Info,
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_RECURRENCE_LABELS,
  getExpenseCategory,
} from '@/lib/finance/categories'

interface ExpenseRow {
  id: string
  expense_date: string
  label: string
  category: string
  amount_ht: number
  vat_rate: number
  vat_amount: number
  amount_ttc: number
  deductible_share: number
  recurrence: string
  payment_method: string | null
  notes: string | null
}

interface FormState {
  expense_date: string
  label: string
  category: string
  amount_ht: string
  vat_rate: string
  deductible_share: string
  recurrence: string
  notes: string
}

function emptyForm(): FormState {
  return {
    expense_date: new Date().toISOString().split('T')[0],
    label: '',
    category: 'autre',
    amount_ht: '',
    vat_rate: '20',
    deductible_share: '100',
    recurrence: 'once',
    notes: '',
  }
}

export default function ExpensesTab({
  year,
  onChanged,
}: {
  year: number
  onChanged?: () => void
}) {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<ExpenseRow | null>(null)
  const [deleting, setDeleting] = useState<ExpenseRow | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const { toast } = useToast()

  const fetchExpenses = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/expenses?startDate=${year}-01-01&endDate=${year}-12-31`,
      )
      if (!response.ok) throw new Error('Chargement impossible')
      const data = await response.json()
      setExpenses(data.expenses ?? [])
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de charger les charges',
      })
    } finally {
      setIsLoading(false)
    }
  }, [year, toast])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  const totals = useMemo(() => {
    let ttc = 0
    let deductible = 0
    let recoverableVat = 0
    const byCategory: Record<string, number> = {}

    for (const expense of expenses) {
      const share = Math.min(1, Math.max(0, expense.deductible_share / 100))
      ttc += expense.amount_ttc
      deductible += expense.amount_ht * share
      recoverableVat += expense.vat_amount * share
      byCategory[expense.category] =
        (byCategory[expense.category] ?? 0) + expense.amount_ttc
    }

    return { ttc, deductible, recoverableVat, byCategory }
  }, [expenses])

  const sortedCategories = useMemo(
    () =>
      Object.entries(totals.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 6),
    [totals.byCategory],
  )

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setShowDialog(true)
  }

  const openEdit = (expense: ExpenseRow) => {
    setEditing(expense)
    setForm({
      expense_date: expense.expense_date,
      label: expense.label,
      category: expense.category,
      amount_ht: String(expense.amount_ht),
      vat_rate: String(Math.round(expense.vat_rate * 100)),
      deductible_share: String(expense.deductible_share),
      recurrence: expense.recurrence,
      notes: expense.notes ?? '',
    })
    setShowDialog(true)
  }

  /** Pré-remplit TVA et quote-part selon le poste choisi. */
  const handleCategoryChange = (category: string) => {
    const preset = getExpenseCategory(category)
    setForm((previous) => ({
      ...previous,
      category,
      vat_rate: preset ? String(Math.round(preset.defaultVatRate * 100)) : previous.vat_rate,
      deductible_share: preset
        ? String(preset.defaultDeductibleShare)
        : previous.deductible_share,
    }))
  }

  const handleSave = async () => {
    const amountHt = parseFloat(form.amount_ht.replace(',', '.'))
    if (!form.label.trim() || isNaN(amountHt)) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Renseignez un libellé et un montant valides',
      })
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        expense_date: form.expense_date,
        label: form.label.trim(),
        category: form.category,
        amount_ht: amountHt,
        vat_rate: (parseFloat(form.vat_rate.replace(',', '.')) || 0) / 100,
        deductible_share: parseFloat(form.deductible_share.replace(',', '.')) || 0,
        recurrence: form.recurrence,
        notes: form.notes.trim() || null,
      }

      const response = await fetch(
        editing ? `/api/expenses/${editing.id}` : '/api/expenses',
        {
          method: editing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Enregistrement impossible')
      }

      toast({
        variant: 'success',
        title: editing ? 'Charge modifiée' : 'Charge ajoutée',
        description: form.label.trim(),
      })

      setShowDialog(false)
      await fetchExpenses()
      onChanged?.()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Enregistrement impossible',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return

    try {
      const response = await fetch(`/api/expenses/${deleting.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Suppression impossible')

      toast({ variant: 'success', title: 'Charge supprimée', description: deleting.label })
      setDeleting(null)
      await fetchExpenses()
      onChanged?.()
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de supprimer cette charge',
      })
    }
  }

  const selectedCategory = getExpenseCategory(form.category)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Les charges de {year} déterminent votre bénéfice, donc vos cotisations et
          votre impôt. Sans elles, l&apos;estimation de rémunération est fausse.
        </p>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une charge
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Total décaissé
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">
                {formatCurrency(totals.ttc)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {expenses.length} charge{expenses.length > 1 ? 's' : ''} sur {year}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Base déductible
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">
                {formatCurrency(totals.deductible)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Hors taxes, quote-part professionnelle appliquée
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Info className="h-4 w-4" />
                TVA supportée
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">
                {formatCurrency(totals.recoverableVat)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Récupérable seulement si vous êtes assujetti
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {sortedCategories.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Principaux postes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {sortedCategories.map(([category, amount]) => {
              const share = totals.ttc > 0 ? (amount / totals.ttc) * 100 : 0
              return (
                <div key={category}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{EXPENSE_CATEGORY_LABELS[category] ?? category}</span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(amount)}
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        {share.toFixed(0)} %
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détail des charges</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-10">
              <Receipt className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Aucune charge enregistrée sur {year}
              </p>
              <Button variant="outline" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter la première
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl glass-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead>Poste</TableHead>
                    <TableHead className="text-right">HT</TableHead>
                    <TableHead className="text-right">TVA</TableHead>
                    <TableHead className="text-right">TTC</TableHead>
                    <TableHead className="text-center">Déductible</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(expense.expense_date)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {expense.label}
                        {expense.recurrence !== 'once' && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {EXPENSE_RECURRENCE_LABELS[expense.recurrence]}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(expense.amount_ht)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {expense.vat_amount > 0 ? formatCurrency(expense.vat_amount) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {formatCurrency(expense.amount_ttc)}
                      </TableCell>
                      <TableCell className="text-center">
                        {expense.deductible_share === 100 ? (
                          <span className="text-muted-foreground">100 %</span>
                        ) : (
                          <Badge variant="outline">{expense.deductible_share} %</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => openEdit(expense)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeleting(expense)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Modifier la charge' : 'Nouvelle charge'}
            </DialogTitle>
            <DialogDescription>
              Saisissez le montant hors taxes : la TVA et le total TTC en découlent.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.expense_date}
                  onChange={(event) =>
                    setForm({ ...form, expense_date: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Récurrence</Label>
                <Select
                  value={form.recurrence}
                  onValueChange={(value) => setForm({ ...form, recurrence: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EXPENSE_RECURRENCE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Libellé</Label>
              <Input
                value={form.label}
                placeholder="Loyer du cabinet — janvier"
                onChange={(event) => setForm({ ...form, label: event.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Poste</Label>
              <Select value={form.category} onValueChange={handleCategoryChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((category) => (
                    <SelectItem key={category.key} value={category.key}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCategory?.hint && (
                <p className="text-xs text-muted-foreground">{selectedCategory.hint}</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Montant HT</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount_ht}
                  onChange={(event) =>
                    setForm({ ...form, amount_ht: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>TVA (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.vat_rate}
                  onChange={(event) => setForm({ ...form, vat_rate: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Déductible (%)</Label>
                <Input
                  type="number"
                  step="1"
                  value={form.deductible_share}
                  onChange={(event) =>
                    setForm({ ...form, deductible_share: event.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette charge ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {deleting?.label} » sera définitivement supprimée et vos estimations
              seront recalculées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
