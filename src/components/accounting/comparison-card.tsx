'use client'

import { useMemo, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Scale, RotateCcw, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { simulate } from '@/lib/finance/simulator'
import type { ExpenseTotals, FinanceSettings } from '@/lib/finance/types'

interface PracticeContext {
  averagePrice: number | null
  /** `observed` : panier moyen constaté ; `configured` : tarif saisi dans Objectifs. */
  averagePriceSource: 'observed' | 'configured'
  consultationCount: number
  configuredAveragePrice: number | null
  workingDaysPerWeek: number
  vacationWeeks: number
}

/**
 * Simulateur « et si ». Le moteur étant une fonction pure, il tourne
 * directement dans le navigateur : chaque déplacement du curseur rejoue le
 * calcul complet — cotisations, impôt, TVA — sans aller-retour serveur.
 *
 * Le raisonnement se fait toujours sur une année entière, comme le reste de
 * l'onglet : comparer des demi-exercices n'aurait aucun sens face à un barème
 * progressif.
 */
export default function ComparisonCard({
  year,
  settings,
  expenses,
  practice,
  baselineRevenue,
  baselineMonthlyDraw,
}: {
  year: number
  settings: FinanceSettings
  expenses: ExpenseTotals
  practice: PracticeContext
  baselineRevenue: number
  baselineMonthlyDraw: number
}) {
  const [mode, setMode] = useState<'revenue' | 'patients'>('revenue')
  const [deltaPercent, setDeltaPercent] = useState(0)
  const [extraPatients, setExtraPatients] = useState(0)

  // Semaines réellement travaillées, cohérentes avec la page Objectifs.
  const workingWeeks = Math.max(1, 52 - practice.vacationWeeks)
  const averagePrice = practice.averagePrice ?? 0

  // Nombre de consultations par semaine que représentent les recettes actuelles.
  const currentPatientsPerWeek =
    averagePrice > 0 ? baselineRevenue / averagePrice / workingWeeks : 0

  const simulatedRevenue = useMemo(() => {
    if (mode === 'patients') {
      if (averagePrice <= 0) return baselineRevenue
      return Math.max(0, baselineRevenue + extraPatients * averagePrice * workingWeeks)
    }
    return Math.max(0, baselineRevenue * (1 + deltaPercent / 100))
  }, [mode, deltaPercent, extraPatients, averagePrice, workingWeeks, baselineRevenue])

  const simulated = useMemo(
    () =>
      simulate({
        year,
        settings,
        revenue: simulatedRevenue,
        expenses,
        monthsElapsed: 12,
      }),
    [year, settings, simulatedRevenue, expenses],
  )

  const newPatientsPerWeek =
    averagePrice > 0 ? simulatedRevenue / averagePrice / workingWeeks : 0

  const newMonthlyDraw = simulated.recommendedMonthlyDraw
  const drawDelta = newMonthlyDraw - baselineMonthlyDraw
  const revenueDelta = simulatedRevenue - baselineRevenue
  const isChanged = Math.abs(revenueDelta) > 1

  // Part de chaque euro supplémentaire qui finit réellement dans la poche.
  const marginalKeepRate =
    Math.abs(revenueDelta) > 1 ? (drawDelta * 12) / revenueDelta : 0

  const reset = () => {
    setDeltaPercent(0)
    setExtraPatients(0)
  }

  const patientsDisabled = mode === 'patients' && averagePrice <= 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Et si mon activité changeait ?
            </CardTitle>
            <CardDescription>
              Faites varier vos recettes et voyez l&apos;effet réel sur votre
              rémunération, cotisations et impôt recalculés.
            </CardDescription>
          </div>
          {isChanged && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Réinitialiser
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setMode('revenue')}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
              mode === 'revenue' ? 'bg-background shadow-sm' : 'text-muted-foreground'
            }`}
          >
            Chiffre d&apos;affaires
          </button>
          <button
            type="button"
            onClick={() => setMode('patients')}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
              mode === 'patients' ? 'bg-background shadow-sm' : 'text-muted-foreground'
            }`}
          >
            Patients / semaine
          </button>
        </div>

        {mode === 'revenue' ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Variation du chiffre d&apos;affaires</Label>
              <span className="text-sm font-semibold tabular-nums">
                {deltaPercent > 0 ? '+' : ''}
                {deltaPercent} %
              </span>
            </div>
            <input
              type="range"
              min={-40}
              max={40}
              step={1}
              value={deltaPercent}
              onChange={(event) => setDeltaPercent(Number(event.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>−40 %</span>
              <span>+40 %</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Consultations par semaine, en plus ou en moins</Label>
              <span className="text-sm font-semibold tabular-nums">
                {extraPatients > 0 ? '+' : ''}
                {extraPatients}
              </span>
            </div>
            <input
              type="range"
              min={-10}
              max={10}
              step={1}
              value={extraPatients}
              disabled={patientsDisabled}
              onChange={(event) => setExtraPatients(Number(event.target.value))}
              className="w-full accent-primary disabled:opacity-40"
            />
            {patientsDisabled ? (
              <p className="text-xs text-amber-600">
                Aucune consultation facturée cette année et aucun tarif de référence
                dans Objectifs : impossible de convertir des consultations en
                recettes.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {currentPatientsPerWeek.toFixed(1)} → {newPatientsPerWeek.toFixed(1)}{' '}
                  consultations par semaine
                </span>
                <span aria-hidden>·</span>
                <span>
                  {formatCurrency(averagePrice)}{' '}
                  {practice.averagePriceSource === 'observed' ? (
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      panier moyen réel sur {practice.consultationCount} consultations
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      tarif de référence d’Objectifs
                    </Badge>
                  )}
                </span>
                <span aria-hidden>·</span>
                <span>{workingWeeks} semaines travaillées</span>
              </div>
            )}
          </div>
        )}

        {/* Effet sur le chiffre d'affaires, visible quel que soit le mode. */}
        <div className="rounded-xl border border-border px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1">
            Chiffre d&apos;affaires annuel
          </p>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-sm tabular-nums text-muted-foreground line-through decoration-muted-foreground/40">
              {formatCurrency(baselineRevenue)}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xl font-bold tabular-nums">
              {formatCurrency(simulatedRevenue)}
            </span>
            {isChanged && (
              <span
                className={`text-sm font-semibold tabular-nums ${
                  revenueDelta > 0 ? 'text-emerald-600' : 'text-destructive'
                }`}
              >
                {revenueDelta > 0 ? '+' : ''}
                {formatCurrency(revenueDelta)}
              </span>
            )}
          </div>
          {isChanged && (
            <p className="text-xs text-muted-foreground mt-1">
              soit {revenueDelta > 0 ? '+' : ''}
              {formatCurrency(revenueDelta / 12)} par mois de recettes
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border px-3.5 py-3">
            <p className="text-xs text-muted-foreground">Aujourd&apos;hui</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums">
              {formatCurrency(baselineMonthlyDraw)}
            </p>
            <p className="text-[11px] text-muted-foreground">net / mois</p>
          </div>
          <div
            className={`rounded-xl border px-3.5 py-3 ${
              isChanged ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <p className="text-xs text-muted-foreground">Avec ce changement</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums">
              {formatCurrency(newMonthlyDraw)}
            </p>
            <p className="text-[11px] text-muted-foreground">net / mois</p>
          </div>
          <div className="rounded-xl border border-border px-3.5 py-3">
            <p className="text-xs text-muted-foreground">Différence</p>
            <p
              className={`mt-0.5 text-lg font-bold tabular-nums ${
                drawDelta > 0
                  ? 'text-emerald-600'
                  : drawDelta < 0
                    ? 'text-destructive'
                    : ''
              }`}
            >
              {drawDelta > 0 ? '+' : ''}
              {formatCurrency(drawDelta)}
            </p>
            <p className="text-[11px] text-muted-foreground">net / mois</p>
          </div>
        </div>

        {isChanged && (
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-2 text-sm">
            <div className="flex items-center gap-2 font-medium">
              {revenueDelta > 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive" />
              )}
              Ce que devient votre note
            </div>

            <div className="flex items-center justify-between text-muted-foreground">
              <span>Cotisations sociales</span>
              <span className="tabular-nums">
                {formatCurrency(simulated.social.total)}
              </span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Impôt sur le revenu</span>
              <span className="tabular-nums">
                {formatCurrency(simulated.incomeTax.attributableToActivity)} · tranche{' '}
                {(simulated.incomeTax.marginalRate * 100).toFixed(0)} %
              </span>
            </div>

            <p className="pt-2 border-t border-border text-muted-foreground">
              Sur {revenueDelta > 0 ? 'chaque euro gagné en plus' : 'chaque euro perdu'},
              vous {revenueDelta > 0 ? 'conservez' : 'ne perdez que'}{' '}
              <span className="font-semibold text-foreground">
                {(Math.abs(marginalKeepRate) * 100).toFixed(0)} centimes
              </span>{' '}
              une fois cotisations et impôt payés.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
