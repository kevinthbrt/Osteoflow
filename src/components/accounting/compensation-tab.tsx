'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Wallet,
  Loader2,
  Settings2,
  TriangleAlert,
  ArrowRight,
  PiggyBank,
  Landmark,
  Receipt,
  Info,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import type { SimulationResult } from '@/lib/finance/types'
import type { UseFinanceSettings } from '@/hooks/use-finance-settings'
import type { ExpenseTotals, FinanceSettings } from '@/lib/finance/types'
import ComparisonCard from '@/components/accounting/comparison-card'

interface SimulationResponse {
  simulation: SimulationResult
  settings: FinanceSettings
  context: {
    expenses: ExpenseTotals
    practice: {
      averagePrice: number | null
      averagePriceSource: 'observed' | 'configured'
      consultationCount: number
      configuredAveragePrice: number | null
      workingDaysPerWeek: number
      vacationWeeks: number
    }
    year: number
    monthsElapsed: number
    revenueToDate: number
    annualisedRevenue: number
    month: number
    monthRevenue: number
    expenseCount: number
    inputMode: string
    pass: number
    scalesVerifiedOn: string
    sources: string[]
  }
}

const MONTH_NAMES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

const VAT_REGIME_LABELS: Record<string, string> = {
  exempt_261: 'Exonéré (art. 261-4-1° du CGI)',
  franchise_293b: 'Franchise en base (art. 293 B)',
  vat_20: 'Assujetti à la TVA',
}

export default function CompensationTab({
  year,
  finance,
}: {
  year: number
  finance: UseFinanceSettings
}) {
  const { form, patch, vatRegime, country, isSaving, isConfigured, save, revision } =
    finance
  const [data, setData] = useState<SimulationResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [view, setView] = useState<'month' | 'year'>('month')
  const [selectedMonth, setSelectedMonth] = useState(() =>
    year === new Date().getFullYear() ? new Date().getMonth() + 1 : 12,
  )
  const { toast } = useToast()

  useEffect(() => {
    let cancelled = false

    async function loadSimulation() {
      setIsLoading(true)
      try {
        const response = await fetch(
          `/api/finance/simulation?year=${year}&month=${selectedMonth}`,
        )
        if (cancelled) return
        setData(response.ok ? await response.json() : null)
      } catch {
        if (!cancelled) {
          toast({
            variant: 'destructive',
            title: 'Erreur',
            description: 'Impossible de charger la simulation',
          })
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    loadSimulation()
    return () => {
      cancelled = true
    }
    // `revision` change à chaque enregistrement : la simulation se rejoue alors.
  }, [year, selectedMonth, revision, toast])

  // Première visite : on ouvre directement la configuration.
  useEffect(() => {
    if (!isConfigured) setShowSettings(true)
  }, [isConfigured])

  const handleSave = async () => {
    await save()
  }

  if (country !== 'FR') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Simulation indisponible</CardTitle>
          <CardDescription>
            Le calcul repose sur les barèmes fiscaux et sociaux français. Votre
            cabinet étant configuré hors de France, la simulation ne s&apos;applique
            pas.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    )
  }

  const simulation = data?.simulation
  const context = data?.context

  // Décaissements annuels hors Urssaf courante et impôt (charges payées,
  // régularisation, Madelin/PER), reconstitués par identité de trésorerie.
  const annualCashCharges =
    simulation && context
      ? context.annualisedRevenue -
        simulation.vat.due -
        simulation.social.total -
        simulation.incomeTax.attributableToActivity -
        simulation.availableIncome
      : 0
  const monthlyCashCharges = annualCashCharges / 12
  // Charges décaissées ordinaires = décaissements totaux moins ce qui est déjà
  // affiché sur sa propre ligne (régularisation, cotisations facultatives).
  const paidExpensesOnly = simulation
    ? annualCashCharges -
      simulation.priorYearSocialSettlement -
      (simulation.optionalContributions?.totalPaid ?? 0)
    : 0

  // Vue mensuelle : sur les encaissements du mois, on provisionne au taux
  // annuel et on retient la part mensuelle des charges décaissées.
  const monthRevenue = context?.monthRevenue ?? 0
  const revenueShare =
    context && context.annualisedRevenue > 0
      ? monthRevenue / context.annualisedRevenue
      : 0
  const monthSocial = simulation ? simulation.social.total * revenueShare : 0
  const monthIr = simulation
    ? simulation.incomeTax.attributableToActivity * revenueShare
    : 0
  const monthVat = simulation ? simulation.vat.due * revenueShare : 0
  const monthSafety = simulation ? simulation.safetyMargin * revenueShare : 0

  // Circuit réel de l'argent : l'Urssaf, la TVA et la marge restent sur le
  // compte professionnel ; l'impôt, lui, est prélevé sur le compte personnel.
  // Le virement pro → perso contient donc la provision d'impôt, à garder de
  // côté une fois arrivée sur le perso.
  const grossTransfer =
    monthRevenue - monthlyCashCharges - monthSocial - monthVat - monthSafety
  const monthDraw = grossTransfer - monthIr

  // Même distinction en vue annuelle : le virement pro → perso moyen contient
  // la provision d'impôt ; le net est ce qui reste une fois celle-ci mise de
  // côté sur le compte personnel.
  const annualGrossTransfer = simulation
    ? simulation.recommendedAnnualDraw + simulation.incomeTax.attributableToActivity
    : 0
  const monthlyGrossTransfer = annualGrossTransfer / 12
  const isCurrentMonth =
    context !== undefined &&
    year === new Date().getFullYear() &&
    context.month === new Date().getMonth() + 1

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Estimation de ce que vous pouvez vous verser, une fois cotisations,
          impôt et TVA provisionnés.
        </p>
        <Button
          variant="outline"
          className="shrink-0"
          onClick={() => setShowSettings(!showSettings)}
        >
          <Settings2 className="mr-2 h-4 w-4" />
          Ma situation
        </Button>
      </div>

      {showSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ma situation</CardTitle>
            <CardDescription>
              Ces éléments déterminent l&apos;assiette des cotisations et la tranche
              d&apos;imposition. Une saisie approximative donne une estimation
              approximative.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Régime fiscal</Label>
                <Select
                  value={form.regime}
                  onValueChange={(value) => patch({ regime: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="micro_bnc">Micro-BNC</SelectItem>
                    <SelectItem value="reel_bnc">BNC — déclaration contrôlée</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {form.regime === 'micro_bnc'
                    ? 'Abattement forfaitaire de 34 % : vos charges réelles n’entrent pas dans le calcul.'
                    : 'Vos charges réelles sont déduites du bénéfice imposable.'}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Caisse de retraite</Label>
                <Select
                  value={form.retirement_fund}
                  onValueChange={(value) => patch({ retirement_fund: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ssi">Régime des indépendants</SelectItem>
                    <SelectItem value="cipav">Cipav</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Cipav si vous êtes installé avant 2019.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Situation de famille</Label>
                <Select
                  value={form.marital_status}
                  onValueChange={(value) => patch({ marital_status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Célibataire</SelectItem>
                    <SelectItem value="couple">Marié ou pacsé</SelectItem>
                    <SelectItem value="single_parent">Parent isolé</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Enfants à charge</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.dependents}
                  onChange={(event) =>
                    patch({ dependents: Number(event.target.value) || 0 })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Autres revenus du foyer (annuels)</Label>
                <Input
                  type="number"
                  min={0}
                  step="100"
                  value={form.other_household_income}
                  onChange={(event) =>
                    patch({ other_household_income: Number(event.target.value) || 0, })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Salaires du conjoint notamment : ils déterminent votre tranche.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  Marge de sécurité (%)
                  <HelpTip>
                    Part du disponible que l&apos;application vous conseille de
                    laisser sur le compte au lieu de vous la verser. Elle absorbe
                    ce que l&apos;estimation ne peut pas prévoir : une
                    régularisation Urssaf plus lourde que prévu, un trimestre
                    creux, une charge oubliée. Elle n&apos;est pas perdue — c&apos;est
                    votre argent, simplement mis de côté. 5 % suffisent quand vos
                    charges sont bien saisies et vos revenus réguliers ; montez à
                    10-15 % en début d&apos;activité, après une forte hausse de
                    revenus, ou si vous saisissez des montants approximatifs.
                  </HelpTip>
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={form.safety_margin_rate}
                  onChange={(event) =>
                    patch({ safety_margin_rate: Number(event.target.value) || 0, })
                  }
                />
              </div>

            </div>

            <div className="flex flex-wrap gap-6">
              {form.regime === 'micro_bnc' && (
                <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                  <Checkbox
                    checked={form.versement_liberatoire}
                    onCheckedChange={(checked) =>
                      patch({ versement_liberatoire: checked === true })
                    }
                  />
                  Versement libératoire de l&apos;impôt
                </label>
              )}
              <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                <Checkbox
                  checked={form.acre}
                  onCheckedChange={(checked) =>
                    patch({ acre: checked === true })
                  }
                />
                Bénéficiaire de l&apos;Acre
              </label>
            </div>

            {/* Cotisations facultatives */}
            <div className="space-y-3 rounded-xl border border-border px-4 py-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Cotisations facultatives</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Retraite Madelin ou PER (annuel)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="100"
                    value={form.optional_retirement}
                    onChange={(event) =>
                      patch({ optional_retirement: Number(event.target.value) || 0, })
                    }
                  />
                </div>
                {form.regime === 'reel_bnc' && (
                  <div className="space-y-2">
                    <Label>Prévoyance et santé Madelin (annuel)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="100"
                      value={form.optional_prevoyance}
                      onChange={(event) =>
                        patch({ optional_prevoyance: Number(event.target.value) || 0, })
                      }
                    />
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Ces versements réduisent votre impôt, mais pas vos cotisations
                Urssaf : elles restent calculées sur un revenu qui les réintègre.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
              <p className="text-sm">
                <span className="text-muted-foreground">Régime de TVA : </span>
                <span className="font-medium">
                  {VAT_REGIME_LABELS[vatRegime] ?? vatRegime}
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Défini dans Paramètres, avec les mentions légales de vos factures.
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer et recalculer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!simulation || !context ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Aucune donnée à simuler sur {year}.
          </CardContent>
        </Card>
      ) : (
        <>
          {simulation.warnings.map((warning) => (
            <div
              key={warning.key}
              className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${
                warning.severity === 'warning'
                  ? 'border-amber-500/40 bg-amber-500/10'
                  : 'border-border bg-muted/30'
              }`}
            >
              {warning.severity === 'warning' ? (
                <TriangleAlert className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
              ) : (
                <Info className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
              )}
              <p className="text-sm text-muted-foreground">{warning.message}</p>
            </div>
          ))}

          {simulation.vat.franchiseWarning !== 'none' && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
              <TriangleAlert className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Seuils de franchise en base de TVA</p>
                <p className="text-muted-foreground">
                  {simulation.vat.franchiseWarning === 'approaching' &&
                    'Vous approchez du seuil de 37 500 €. Au-delà, la TVA devient exigible.'}
                  {simulation.vat.franchiseWarning === 'exceeded' &&
                    'Vous avez dépassé le seuil de 37 500 €. La TVA s’appliquera l’an prochain, ou dès maintenant en cas de dépassement du seuil majoré.'}
                  {simulation.vat.franchiseWarning === 'tolerance_exceeded' &&
                    'Vous avez dépassé le seuil majoré de 41 250 € : la TVA est exigible dès le premier jour du mois de dépassement.'}
                </p>
              </div>
            </div>
          )}

          {/* Sélecteur de vue : le mois pour piloter, l'année pour la vue d'ensemble */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setView('month')}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  view === 'month' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                }`}
              >
                Ce mois-ci
              </button>
              <button
                type="button"
                onClick={() => setView('year')}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  view === 'year' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                }`}
              >
                Année {year}
              </button>
            </div>

            {view === 'month' && (
              <Select
                value={String(context.month)}
                onValueChange={(value) => setSelectedMonth(Number(value))}
              >
                <SelectTrigger className="h-9 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.slice(0, context.monthsElapsed).map((name, index) => (
                    <SelectItem key={index + 1} value={String(index + 1)}>
                      {name.charAt(0).toUpperCase() + name.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {view === 'month' ? (
            /* Vue mensuelle : le circuit réel de l'argent. L'Urssaf, la TVA et
               la marge restent sur le compte pro ; l'impôt étant prélevé sur le
               compte perso, le virement pro → perso contient sa provision. */
            <div className="relative overflow-hidden rounded-2xl gradient-primary text-white p-6 shadow-lg">
              <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/15 blur-3xl" />
              <div className="relative grid gap-6 lg:grid-cols-[1.1fr_1fr]">
                <div>
                  <div className="flex items-center gap-1.5 text-white/80 text-xs font-medium">
                    <Wallet className="h-3.5 w-3.5" />
                    Virement vers votre compte perso · {MONTH_NAMES[context.month - 1]} {year}
                  </div>
                  <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums leading-none">
                    {formatCurrency(Math.max(0, grossTransfer))}
                  </p>
                  <p className="mt-1.5 text-xs text-white/75">
                    {isCurrentMonth
                      ? 'Mois en cours : le montant grandit avec vos encaissements.'
                      : grossTransfer < 0
                        ? 'Mois creux : les encaissements ne couvrent pas la part mensuelle des charges.'
                        : `Dont ${formatCurrency(monthIr)} à garder de côté pour l’impôt, prélevé sur le compte perso.`}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 px-3.5 py-3">
                      <p className="text-[11px] text-white/75 font-medium">
                        Net d&apos;impôt, dans votre poche
                      </p>
                      <p className="mt-1 text-lg font-bold tabular-nums">
                        {formatCurrency(Math.max(0, monthDraw))}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 px-3.5 py-3">
                      <p className="text-[11px] text-white/75 font-medium">
                        Rythme annuel, net d&apos;impôt
                      </p>
                      <p className="mt-1 text-lg font-bold tabular-nums">
                        {formatCurrency(simulation.recommendedMonthlyDraw)}
                        <span className="text-xs font-medium text-white/70"> / mois</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 px-4 py-3.5">
                  <div className="text-white/80 text-xs font-medium mb-3">
                    Le mois de {MONTH_NAMES[context.month - 1]}, pas à pas
                  </div>
                  <div className="space-y-2 text-sm">
                    <ProvisionLine label="Encaissé" amount={monthRevenue} />
                    <ProvisionLine
                      label="Charges (moyenne mensuelle)"
                      amount={-monthlyCashCharges}
                    />
                    <ProvisionLine label="Urssaf à provisionner" amount={-monthSocial} />
                    {monthVat > 0 && (
                      <ProvisionLine label="TVA à provisionner" amount={-monthVat} />
                    )}
                    {monthSafety > 0 && (
                      <ProvisionLine label="Marge de sécurité" amount={-monthSafety} />
                    )}
                    <div className="pt-2 mt-2 border-t border-white/20 flex items-center justify-between font-semibold">
                      <span>Virement pro → perso</span>
                      <span className="tabular-nums">{formatCurrency(grossTransfer)}</span>
                    </div>
                    <ProvisionLine
                      label="Impôt (prélevé sur le perso)"
                      amount={-monthIr}
                    />
                    <div className="pt-2 mt-2 border-t border-white/20 flex items-center justify-between font-semibold">
                      <span>Net dans votre poche</span>
                      <span className="tabular-nums">{formatCurrency(monthDraw)}</span>
                    </div>
                    <p className="text-[11px] text-white/60 pt-1">
                      Urssaf, TVA et marge restent sur le compte pro ; l&apos;impôt
                      part avec le virement, à garder de côté sur le perso. Taux
                      calculés sur l&apos;année entière.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Vue annuelle : projection de l'année au rythme constaté */
            <div className="relative overflow-hidden rounded-2xl gradient-primary text-white p-6 shadow-lg">
              <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/15 blur-3xl" />
              <div className="relative grid gap-6 lg:grid-cols-[1.1fr_1fr]">
                <div>
                  <div className="flex items-center gap-1.5 text-white/80 text-xs font-medium">
                    <Wallet className="h-3.5 w-3.5" />
                    {context.monthsElapsed < 12
                      ? `Projection ${year}, au rythme de vos jours travaillés`
                      : `Année ${year}`}
                    {' · virement pro → perso'}
                  </div>
                  <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums leading-none">
                    {formatCurrency(monthlyGrossTransfer)}
                    <span className="text-lg font-medium text-white/70"> / mois</span>
                  </p>
                  <p className="mt-1.5 text-xs text-white/75">
                    Dont {formatCurrency(simulation.monthlyProvisions.incomeTax)} à garder
                    pour l&apos;impôt, prélevé sur le compte perso.
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 px-3.5 py-3">
                      <p className="text-[11px] text-white/75 font-medium">
                        Net d&apos;impôt, dans votre poche
                      </p>
                      <p className="mt-1 text-lg font-bold tabular-nums">
                        {formatCurrency(simulation.recommendedMonthlyDraw)}
                        <span className="text-xs font-medium text-white/70"> / mois</span>
                      </p>
                      <p className="text-[11px] text-white/60">
                        {formatCurrency(simulation.recommendedAnnualDraw)} sur l&apos;année
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 px-3.5 py-3">
                      <p className="text-[11px] text-white/75 font-medium">
                        Recettes {context.monthsElapsed < 12 ? 'projetées' : 'encaissées'}
                      </p>
                      <p className="mt-1 text-lg font-bold tabular-nums">
                        {formatCurrency(context.annualisedRevenue)}
                      </p>
                      {context.monthsElapsed < 12 && (
                        <p className="text-[11px] text-white/60">
                          {formatCurrency(context.revenueToDate)} encaissés à ce jour
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 px-4 py-3.5">
                  <div className="text-white/80 text-xs font-medium mb-3">
                    À provisionner chaque mois
                  </div>
                  <div className="space-y-2 text-sm">
                    <ProvisionLine
                      label="Cotisations sociales"
                      amount={simulation.monthlyProvisions.social}
                    />
                    <ProvisionLine
                      label="Impôt sur le revenu"
                      amount={simulation.monthlyProvisions.incomeTax}
                    />
                    {simulation.monthlyProvisions.vat > 0 && (
                      <ProvisionLine
                        label="TVA à reverser"
                        amount={simulation.monthlyProvisions.vat}
                      />
                    )}
                    <ProvisionLine
                      label="Marge de sécurité"
                      amount={simulation.monthlyProvisions.safety}
                    />
                    <div className="pt-2 mt-2 border-t border-white/20 flex items-center justify-between font-semibold">
                      <span>Total</span>
                      <span className="tabular-nums">
                        {formatCurrency(simulation.monthlyProvisions.total)}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/60 pt-1">
                      Soit {(simulation.provisionRate * 100).toFixed(0)} % de vos recettes
                      à mettre de côté.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Enchaînement du calcul, sur l'année entière. Chaque ligne est une
              vraie entrée ou sortie d'argent : la somme tombe exactement sur le
              disponible. Les déductions sans décaissement (barème kilométrique,
              forfaits) sont détaillées à part, car elles réduisent cotisations
              et impôt sans faire sortir un euro. */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Du chiffre d&apos;affaires à votre poche
              </CardTitle>
              <CardDescription>
                {context.monthsElapsed < 12
                  ? `Année ${year} projetée au rythme constaté sur vos jours travaillés — le même calcul que la page Objectifs.`
                  : `Année ${year}.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <FlowLine
                label="Recettes encaissées"
                amount={context.annualisedRevenue}
                tone="positive"
                hint={
                  context.monthsElapsed < 12
                    ? `${formatCurrency(context.revenueToDate)} encaissés à ce jour, projetés sur l'année`
                    : undefined
                }
              />
              {simulation.vat.due > 0 && (
                <FlowLine
                  label="TVA à reverser"
                  amount={-simulation.vat.due}
                  hint="Encaissée pour le compte du Trésor, jamais un revenu"
                />
              )}
              <FlowLine
                label="Charges décaissées"
                amount={-paidExpensesOnly}
                hint={
                  context.inputMode === 'simple'
                    ? 'Montants annuels du mode simplifié'
                    : context.expenseCount === 0
                      ? 'Aucune charge saisie : l’estimation est optimiste'
                      : `${context.expenseCount} charge${context.expenseCount > 1 ? 's' : ''} saisie${context.expenseCount > 1 ? 's' : ''}, projetées sur l’année`
                }
              />
              {simulation.assetPurchases > 0 && (
                <FlowLine
                  label="Achat d’immobilisations"
                  amount={-simulation.assetPurchases}
                  hint="Sortie de trésorerie intégrale ; la déduction s’étale sur la durée d’usage"
                />
              )}
              {simulation.priorYearSocialSettlement > 0 && (
                <FlowLine
                  label="Régularisation Urssaf antérieure"
                  amount={-simulation.priorYearSocialSettlement}
                  hint="Déductible de l’impôt, sans effet sur l’assiette des cotisations"
                />
              )}
              {simulation.optionalContributions &&
                simulation.optionalContributions.totalPaid > 0 && (
                  <FlowLine
                    label="Retraite et prévoyance facultatives"
                    amount={-simulation.optionalContributions.totalPaid}
                    hint="Réduit l’impôt, pas les cotisations Urssaf"
                  />
                )}
              <FlowLine
                label="Cotisations sociales"
                amount={-simulation.social.total}
                hint={`Assiette : ${formatCurrency(simulation.social.assiette)}`}
              />
              <FlowLine
                label="Impôt sur le revenu"
                amount={-simulation.incomeTax.attributableToActivity}
                hint={`${simulation.incomeTax.parts} part${simulation.incomeTax.parts > 1 ? 's' : ''} · tranche marginale ${(simulation.incomeTax.marginalRate * 100).toFixed(0)} %`}
              />
              <div className="flex items-center justify-between pt-3 mt-2 border-t border-border">
                <span className="font-semibold">Disponible</span>
                <span className="text-xl font-bold tabular-nums text-primary">
                  {formatCurrency(simulation.availableIncome)}
                </span>
              </div>

              {(simulation.mileage ||
                simulation.flatAllowances > 0 ||
                simulation.depreciation > 0) && (
                <div className="mt-3 rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground/80 mb-1">
                    Déductions sans décaissement — déjà comptées dans les
                    cotisations et l&apos;impôt ci-dessus
                  </p>
                  {simulation.mileage && (
                    <p>
                      Barème kilométrique : {formatCurrency(simulation.mileage.allowance)}{' '}
                      ({simulation.mileage.formula})
                    </p>
                  )}
                  {simulation.flatAllowances > 0 && (
                    <p>Forfaits (blanchissage…) : {formatCurrency(simulation.flatAllowances)}</p>
                  )}
                  {simulation.depreciation > 0 && (
                    <p>
                      Dotation aux amortissements :{' '}
                      {formatCurrency(simulation.depreciation)}
                    </p>
                  )}
                  <p className="mt-1">
                    Elles réduisent votre bénéfice imposable sans faire sortir un
                    euro du compte : c&apos;est pourquoi elles n&apos;apparaissent pas
                    dans l&apos;enchaînement.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Détail des cotisations */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Landmark className="h-4 w-4" />
                  Cotisations sociales
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {simulation.social.lines.map((line) => (
                  <div key={line.key} className="flex items-start justify-between gap-4 text-sm">
                    <div>
                      <p>{line.label}</p>
                      {line.detail && (
                        <p className="text-xs text-muted-foreground">{line.detail}</p>
                      )}
                    </div>
                    <span
                      className={`tabular-nums font-medium shrink-0 ${line.amount < 0 ? 'text-emerald-600' : ''}`}
                    >
                      {formatCurrency(line.amount)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 mt-1 border-t border-border font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">
                    {formatCurrency(simulation.social.total)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Impôt et TVA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Revenu imposable du foyer</span>
                  <span className="tabular-nums font-medium">
                    {formatCurrency(simulation.incomeTax.taxableIncome)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Impôt total du foyer</span>
                  <span className="tabular-nums font-medium">
                    {formatCurrency(simulation.incomeTax.total)}
                  </span>
                </div>
                {simulation.incomeTax.decote > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">dont décote</span>
                    <span className="tabular-nums text-emerald-600">
                      −{formatCurrency(simulation.incomeTax.decote)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Généré par votre activité</span>
                  <span className="tabular-nums font-semibold">
                    {formatCurrency(simulation.incomeTax.attributableToActivity)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Taux moyen du foyer</span>
                  <span className="tabular-nums">
                    {(simulation.incomeTax.averageRate * 100).toFixed(1)} %
                  </span>
                </div>

                <div className="pt-3 mt-1 border-t border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">TVA collectée</span>
                    <span className="tabular-nums">
                      {formatCurrency(simulation.vat.collected)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">TVA déductible</span>
                    <span className="tabular-nums">
                      {formatCurrency(simulation.vat.deductible)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-medium">
                    <span>
                      {simulation.vat.credit > 0 ? 'Crédit de TVA' : 'TVA à reverser'}
                    </span>
                    <span className="tabular-nums">
                      {formatCurrency(
                        simulation.vat.credit > 0 ? simulation.vat.credit : simulation.vat.due,
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {data?.settings && (
            <ComparisonCard
              year={year}
              settings={data.settings}
              expenses={context.expenses}
              practice={context.practice}
              baselineRevenue={context.annualisedRevenue}
              baselineMonthlyDraw={simulation.recommendedMonthlyDraw}
            />
          )}

          {simulation.optionalContributions &&
            simulation.optionalContributions.totalPaid > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    Cotisations facultatives
                  </CardTitle>
                  <CardDescription>
                    Versements Madelin et PER : leur plafond dépend de votre bénéfice.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {simulation.optionalContributions.lines.map((line) => (
                    <div key={line.key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span>{line.label}</span>
                        <span className="tabular-nums font-medium">
                          {formatCurrency(line.deducted)} déduits
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          Versé {formatCurrency(line.paid)} · plafond{' '}
                          {formatCurrency(line.ceiling)}
                        </span>
                        {line.excess > 0 && (
                          <span className="text-amber-600">
                            {formatCurrency(line.excess)} non déductibles
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center justify-between pt-3 mt-1 border-t border-border">
                    <span className="font-medium">Économie d&apos;impôt</span>
                    <span className="tabular-nums font-bold text-emerald-600">
                      {formatCurrency(simulation.optionalContributions.taxSaving)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Coût net de l&apos;effort d&apos;épargne :{' '}
                    {formatCurrency(
                      simulation.optionalContributions.totalPaid -
                        simulation.optionalContributions.taxSaving,
                    )}
                    . Vos cotisations Urssaf sont inchangées.
                  </p>
                </CardContent>
              </Card>
            )}

          {form.target_monthly_draw !== null && form.target_monthly_draw > 0 && (
            <TargetCard
              target={form.target_monthly_draw}
              actual={simulation.recommendedMonthlyDraw}
            />
          )}

          <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Estimation destinée à provisionner, pas une déclaration. Elle ne tient
              compte ni des crédits et réductions d&apos;impôt, ni des déficits
              reportables, ni des revenus de capitaux. Barèmes {context.year} vérifiés
              le {new Date(context.scalesVerifiedOn).toLocaleDateString('fr-FR')}
              {simulation.usesFallbackScales &&
                ' — aucun barème n’étant publié pour cette année, ceux de l’année la plus récente sont appliqués'}
              . En cas de doute, votre comptable reste l&apos;interlocuteur.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

/** Bulle d'aide au survol, pour expliquer une notion sans alourdir le formulaire. */
function HelpTip({ children }: { children: React.ReactNode }) {
  return (
    <span className="group relative inline-flex align-middle">
      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 hidden w-72 -translate-x-1/2 translate-y-2 rounded-lg border border-border bg-popover px-3 py-2 text-xs font-normal leading-relaxed text-popover-foreground shadow-lg group-hover:block"
      >
        {children}
      </span>
    </span>
  )
}

function ProvisionLine({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between text-white/90">
      <span>{label}</span>
      <span className="tabular-nums">{formatCurrency(amount)}</span>
    </div>
  )
}

function FlowLine({
  label,
  amount,
  hint,
  tone,
}: {
  label: string
  amount: number
  hint?: string
  tone?: 'positive'
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <div>
        <p className="text-sm">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <span
        className={`tabular-nums font-medium shrink-0 ${
          tone === 'positive' ? '' : amount < 0 ? 'text-muted-foreground' : ''
        }`}
      >
        {amount < 0 ? `−${formatCurrency(Math.abs(amount))}` : formatCurrency(amount)}
      </span>
    </div>
  )
}

function TargetCard({ target, actual }: { target: number; actual: number }) {
  const gap = actual - target
  const reached = gap >= 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <PiggyBank className="h-4 w-4" />
          Objectif de rémunération
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Visé</p>
          <p className="text-xl font-bold tabular-nums">{formatCurrency(target)}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">Possible</p>
          <p className="text-xl font-bold tabular-nums">{formatCurrency(actual)}</p>
        </div>
        <Badge
          variant={reached ? 'default' : 'secondary'}
          className="ml-auto"
        >
          {reached ? '+' : '−'}
          {formatCurrency(Math.abs(gap))} / mois
        </Badge>
      </CardContent>
    </Card>
  )
}
