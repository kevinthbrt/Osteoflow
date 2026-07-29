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
  Car,
  ShieldCheck,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import type { SimulationResult } from '@/lib/finance/types'

interface SimulationResponse {
  simulation: SimulationResult
  context: {
    year: number
    monthsElapsed: number
    revenue: number
    expenseCount: number
    pass: number
    scalesVerifiedOn: string
    sources: string[]
  }
}

interface SettingsForm {
  regime: string
  retirement_fund: string
  versement_liberatoire: boolean
  acre: boolean
  marital_status: string
  dependents: number
  other_household_income: number
  safety_margin_rate: number
  target_monthly_draw: number | null
  vehicle_mode: string
  vehicle_kind: string
  vehicle_horsepower: number
  vehicle_annual_km: number
  vehicle_electric: boolean
  optional_retirement: number
  optional_prevoyance: number
}

const DEFAULT_FORM: SettingsForm = {
  regime: 'micro_bnc',
  retirement_fund: 'ssi',
  versement_liberatoire: false,
  acre: false,
  marital_status: 'single',
  dependents: 0,
  other_household_income: 0,
  safety_margin_rate: 5,
  target_monthly_draw: null,
  vehicle_mode: 'none',
  vehicle_kind: 'car',
  vehicle_horsepower: 5,
  vehicle_annual_km: 0,
  vehicle_electric: false,
  optional_retirement: 0,
  optional_prevoyance: 0,
}

const VAT_REGIME_LABELS: Record<string, string> = {
  exempt_261: 'Exonéré (art. 261-4-1° du CGI)',
  franchise_293b: 'Franchise en base (art. 293 B)',
  vat_20: 'Assujetti à la TVA',
}

export default function CompensationTab({ year }: { year: number }) {
  const [data, setData] = useState<SimulationResponse | null>(null)
  const [form, setForm] = useState<SettingsForm>(DEFAULT_FORM)
  const [vatRegime, setVatRegime] = useState<string>('exempt_261')
  const [country, setCountry] = useState<string>('FR')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const { toast } = useToast()

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    try {
      const [settingsResponse, simulationResponse] = await Promise.all([
        fetch('/api/finance/settings'),
        fetch(`/api/finance/simulation?year=${year}`),
      ])

      if (settingsResponse.ok) {
        const payload = await settingsResponse.json()
        setVatRegime(payload.vatRegime ?? 'exempt_261')
        setCountry(payload.country ?? 'FR')
        if (payload.settings) {
          setForm({
            regime: payload.settings.regime ?? 'micro_bnc',
            retirement_fund: payload.settings.retirement_fund ?? 'ssi',
            versement_liberatoire: Boolean(payload.settings.versement_liberatoire),
            acre: Boolean(payload.settings.acre),
            marital_status: payload.settings.marital_status ?? 'single',
            dependents: payload.settings.dependents ?? 0,
            other_household_income: payload.settings.other_household_income ?? 0,
            safety_margin_rate: payload.settings.safety_margin_rate ?? 5,
            target_monthly_draw: payload.settings.target_monthly_draw ?? null,
            vehicle_mode: payload.settings.vehicle_mode ?? 'none',
            vehicle_kind: payload.settings.vehicle_kind ?? 'car',
            vehicle_horsepower: payload.settings.vehicle_horsepower ?? 5,
            vehicle_annual_km: payload.settings.vehicle_annual_km ?? 0,
            vehicle_electric: Boolean(payload.settings.vehicle_electric),
            optional_retirement: payload.settings.optional_retirement ?? 0,
            optional_prevoyance: payload.settings.optional_prevoyance ?? 0,
          })
        } else {
          // Aucun paramètre enregistré : on ouvre directement la configuration.
          setShowSettings(true)
        }
      }

      if (simulationResponse.ok) {
        setData(await simulationResponse.json())
      } else {
        setData(null)
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de charger la simulation',
      })
    } finally {
      setIsLoading(false)
    }
  }, [year, toast])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/finance/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Enregistrement impossible')
      }

      toast({ variant: 'success', title: 'Paramètres enregistrés' })
      await fetchAll()
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
                  onValueChange={(value) => setForm({ ...form, regime: value })}
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
                  onValueChange={(value) => setForm({ ...form, retirement_fund: value })}
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
                  onValueChange={(value) => setForm({ ...form, marital_status: value })}
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
                    setForm({ ...form, dependents: Number(event.target.value) || 0 })
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
                    setForm({
                      ...form,
                      other_household_income: Number(event.target.value) || 0,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Salaires du conjoint notamment : ils déterminent votre tranche.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Marge de sécurité (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={form.safety_margin_rate}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      safety_margin_rate: Number(event.target.value) || 0,
                    })
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
                      setForm({ ...form, versement_liberatoire: checked === true })
                    }
                  />
                  Versement libératoire de l&apos;impôt
                </label>
              )}
              <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                <Checkbox
                  checked={form.acre}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, acre: checked === true })
                  }
                />
                Bénéficiaire de l&apos;Acre
              </label>
            </div>

            {/* Véhicule */}
            <div className="space-y-3 rounded-xl border border-border px-4 py-4">
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Frais de véhicule</p>
              </div>

              <Select
                value={form.vehicle_mode}
                onValueChange={(value) => setForm({ ...form, vehicle_mode: value })}
              >
                <SelectTrigger className="sm:w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun frais de véhicule</SelectItem>
                  <SelectItem value="mileage">Barème kilométrique</SelectItem>
                  <SelectItem value="actual">Frais réels (saisis en charges)</SelectItem>
                </SelectContent>
              </Select>

              {form.vehicle_mode === 'mileage' && (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={form.vehicle_kind}
                        onValueChange={(value) => setForm({ ...form, vehicle_kind: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="car">Voiture</SelectItem>
                          <SelectItem value="motorcycle">Moto</SelectItem>
                          <SelectItem value="moped">Cyclomoteur</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Puissance (CV)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={form.vehicle_horsepower}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            vehicle_horsepower: Number(event.target.value) || 1,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Km professionnels</Label>
                      <Input
                        type="number"
                        min={0}
                        step="100"
                        value={form.vehicle_annual_km}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            vehicle_annual_km: Number(event.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={form.vehicle_electric}
                      onCheckedChange={(checked) =>
                        setForm({ ...form, vehicle_electric: checked === true })
                      }
                    />
                    Véhicule 100 % électrique (majoration de 20 %)
                  </label>

                  <p className="text-xs text-muted-foreground">
                    Le barème couvre déjà carburant, entretien, assurance et
                    dépréciation : ne les saisissez pas aussi en charges. Péages,
                    stationnement et intérêts d&apos;emprunt restent déductibles à part.
                    La puissance figure au champ P.6 de la carte grise.
                  </p>
                </>
              )}
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
                      setForm({
                        ...form,
                        optional_retirement: Number(event.target.value) || 0,
                      })
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
                        setForm({
                          ...form,
                          optional_prevoyance: Number(event.target.value) || 0,
                        })
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

          {/* Ce que le praticien peut se verser */}
          <div className="relative overflow-hidden rounded-2xl gradient-primary text-white p-6 shadow-lg">
            <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/15 blur-3xl" />
            <div className="relative grid gap-6 lg:grid-cols-[1.1fr_1fr]">
              <div>
                <div className="flex items-center gap-1.5 text-white/80 text-xs font-medium">
                  <Wallet className="h-3.5 w-3.5" />
                  Rémunération nette possible · {context.monthsElapsed} mois de {year}
                </div>
                <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums leading-none">
                  {formatCurrency(simulation.recommendedMonthlyDraw)}
                  <span className="text-lg font-medium text-white/70"> / mois</span>
                </p>
                <p className="mt-1.5 text-xs text-white/75">
                  Soit {formatCurrency(simulation.recommendedAnnualDraw)} sur la période,
                  marge de sécurité déduite
                </p>

                {simulation.projection && (
                  <div className="mt-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 px-3.5 py-3">
                    <p className="text-[11px] text-white/75 font-medium">
                      Projection à fin {year}, au rythme actuel
                    </p>
                    <p className="mt-1 text-lg font-bold tabular-nums">
                      {formatCurrency(simulation.projection.monthlyDraw)} / mois
                    </p>
                    <p className="text-[11px] text-white/60">
                      pour {formatCurrency(simulation.projection.revenue)} de recettes
                    </p>
                  </div>
                )}
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

          {/* Enchaînement du calcul */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Du chiffre d&apos;affaires à votre poche</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <FlowLine
                label="Recettes encaissées"
                amount={context.revenue}
                tone="positive"
              />
              {simulation.vat.due > 0 && (
                <FlowLine
                  label="TVA à reverser"
                  amount={-simulation.vat.due}
                  hint="Encaissée pour le compte du Trésor, jamais un revenu"
                />
              )}
              <FlowLine
                label="Charges professionnelles"
                amount={-simulation.deductibleExpenses}
                hint={
                  context.expenseCount === 0
                    ? 'Aucune charge saisie : l’estimation est optimiste'
                    : `${context.expenseCount} charge${context.expenseCount > 1 ? 's' : ''} saisie${context.expenseCount > 1 ? 's' : ''}`
                }
              />
              {simulation.mileage && (
                <FlowLine
                  label="Frais de véhicule"
                  amount={-simulation.mileage.allowance}
                  hint={`Barème kilométrique · ${simulation.mileage.formula}`}
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
