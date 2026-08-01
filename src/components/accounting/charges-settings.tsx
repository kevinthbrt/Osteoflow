'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Car, Loader2, Landmark, HelpCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { computeMileageAllowance } from '@/lib/finance/mileage'
import { getTaxConfig } from '@/lib/finance/tax-config'
import type { VehicleKind } from '@/lib/finance/types'
import type { UseFinanceSettings } from '@/hooks/use-finance-settings'

/**
 * Paramétrage de la saisie des charges : mode de saisie, frais de véhicule et
 * régularisation Urssaf.
 *
 * Ces réglages vivent avec les charges plutôt qu'avec la situation fiscale :
 * ils décrivent ce que l'activité coûte, pas la situation personnelle du
 * praticien.
 */
export default function ChargesSettings({
  finance,
  onSaved,
}: {
  finance: UseFinanceSettings
  onSaved?: () => void
}) {
  const { form, patch, vatRegime, isSaving, save } = finance

  const handleSave = async () => {
    const ok = await save()
    if (ok) onSaved?.()
  }

  // Aperçu du barème en direct, pour se comparer immédiatement à la ligne
  // « indemnités kilométriques » d'un prévisionnel comptable.
  const mileagePreview =
    form.vehicle_mode === 'mileage' && form.vehicle_annual_km > 0
      ? computeMileageAllowance(getTaxConfig(new Date().getFullYear()), {
          kind: (form.vehicle_kind as VehicleKind) ?? 'car',
          horsepower: form.vehicle_horsepower,
          annualKm: form.vehicle_annual_km,
          electric: form.vehicle_electric,
        })
      : null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Comment remplir vos charges</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-2">
          <ModeCard
            active={form.input_mode === 'simple'}
            title="Simplifié"
            description="Vous entrez vos grandes masses annuelles, comme sur un prévisionnel comptable. Rapide, suffisant pour provisionner."
            onClick={() => patch({ input_mode: 'simple' })}
          />
          <ModeCard
            active={form.input_mode === 'real'}
            title="Détaillé"
            description="Le calcul s’appuie sur les charges saisies ci-dessous, ligne par ligne. Plus précis, et exploitable par votre comptable."
            onClick={() => patch({ input_mode: 'real' })}
          />
        </div>

        {form.input_mode === 'simple' && (
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-2">
              <Label>Charges annuelles</Label>
              <Input
                type="number"
                min={0}
                step="100"
                value={form.simple_annual_expenses}
                onChange={(event) =>
                  patch({ simple_annual_expenses: Number(event.target.value) || 0 })
                }
              />
              <p className="text-xs text-muted-foreground">
                Hors Urssaf et CFP, hors forfaits
              </p>
            </div>
            {vatRegime === 'vat_20' && (
              <div className="space-y-2">
                <Label>Dont TVA supportée</Label>
                <Input
                  type="number"
                  min={0}
                  step="100"
                  value={form.simple_annual_expenses_vat}
                  onChange={(event) =>
                    patch({
                      simple_annual_expenses_vat: Number(event.target.value) || 0,
                    })
                  }
                />
              </div>
            )}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                Forfaits sans décaissement
                <HelpTip>
                  Déductions forfaitaires auxquelles ne correspond aucune dépense
                  professionnelle réglée : le forfait blanchissage typiquement,
                  souvent évalué à environ 6 € par jour travaillé pour le linge
                  lavé à domicile. Elles réduisent votre bénéfice, donc vos
                  cotisations et votre impôt, sans que l&apos;argent quitte
                  l&apos;activité.
                </HelpTip>
              </Label>
              <Input
                type="number"
                min={0}
                step="50"
                value={form.simple_flat_allowances}
                onChange={(event) =>
                  patch({ simple_flat_allowances: Number(event.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                Dotation aux amortissements
                <HelpTip>
                  Part annuelle du coût de vos biens durables (table, matériel,
                  agencements). Laissez à zéro si vous les saisissez un par un
                  ci-dessous : le plan d&apos;amortissement détaillé prend alors
                  le relais.
                </HelpTip>
              </Label>
              <Input
                type="number"
                min={0}
                step="50"
                value={form.simple_depreciation}
                onChange={(event) =>
                  patch({ simple_depreciation: Number(event.target.value) || 0 })
                }
              />
            </div>
          </div>
        )}

        {/* Frais de véhicule */}
        <div className="space-y-3 rounded-xl border border-border px-4 py-4">
          <div className="flex items-center gap-2">
            <Car className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Frais de véhicule</p>
          </div>

          <Select
            value={form.vehicle_mode}
            onValueChange={(value) => patch({ vehicle_mode: value })}
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
                    onValueChange={(value) => patch({ vehicle_kind: value })}
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
                      patch({ vehicle_horsepower: Number(event.target.value) || 1 })
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
                      patch({ vehicle_annual_km: Number(event.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                <Checkbox
                  checked={form.vehicle_electric}
                  onCheckedChange={(checked) =>
                    patch({ vehicle_electric: checked === true })
                  }
                />
                Véhicule 100 % électrique (majoration de 20 %)
              </label>

              {mileagePreview && (
                <div className="rounded-xl border border-primary/40 bg-primary/5 px-3.5 py-3">
                  <p className="text-xs text-muted-foreground">
                    Déduction calculée au barème {new Date().getFullYear()}
                  </p>
                  <p className="mt-0.5 text-xl font-bold tabular-nums">
                    {formatCurrency(mileagePreview.allowance)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {mileagePreview.formula} — soit{' '}
                    {mileagePreview.effectivePerKm.toFixed(3)} € le kilomètre
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Comptez tous vos kilomètres professionnels de l&apos;année :
                    trajets domicile-cabinet, visites, formations, déplacements
                    administratifs.
                  </p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Le barème couvre déjà carburant, entretien, assurance et
                dépréciation : ne les saisissez pas aussi en charges. Péages,
                stationnement et intérêts d&apos;emprunt restent déductibles à part.
                La puissance figure au champ P.6 de la carte grise.
              </p>
            </>
          )}
        </div>

        {/* Régularisation Urssaf */}
        <div className="space-y-3 rounded-xl border border-border px-4 py-4">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Régularisation Urssaf</p>
          </div>

          <div className="space-y-2 sm:max-w-xs">
            <Label className="flex items-center gap-1.5">
              Reliquat payé cette année
              <HelpTip>
                Régularisation d&apos;une année antérieure réglée sur cet
                exercice. Elle se déduit de votre impôt, mais pas de
                l&apos;assiette qui sert à calculer vos cotisations — celle-ci se
                calcule justement hors cotisations sociales. À saisir ici plutôt
                que comme une charge ordinaire.
              </HelpTip>
            </Label>
            <Input
              type="number"
              min={0}
              step="100"
              value={form.prior_year_social_settlement}
              onChange={(event) =>
                patch({
                  prior_year_social_settlement: Number(event.target.value) || 0,
                })
              }
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

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

function ModeCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3.5 py-3 text-left transition-colors ${
        active
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/40 hover:bg-muted/40'
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <span
          className={`h-3.5 w-3.5 rounded-full border-2 ${
            active ? 'border-primary bg-primary' : 'border-muted-foreground/40'
          }`}
        />
        {title}
      </span>
      <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
    </button>
  )
}
