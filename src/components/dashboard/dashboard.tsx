'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, SlidersHorizontal, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn, formatCurrency } from '@/lib/utils'

import { VideoWidget } from './widgets/video-widget'
import { ProgressWidget } from './widgets/progress-widget'
import { ReviewWidget, FeaturedFormationWidget, type WidgetsData } from './widgets/osteoupgrade-widgets'
import { FlashcardsWidget } from './widgets/flashcards-widget'
import { OsteoUpgradeUpsellWidget } from './widgets/osteoupgrade-upsell'
import { RelaunchWidget } from './widgets/relaunch-widget'
import { ProfileCompletionWidget } from './profile-completion-widget'
import { TodayPanel, type TodaySummary } from './today-panel'
import { HeaderWeather } from '@/components/layout/header-weather'
import { openCommandPalette } from '@/components/layout/command-palette'
import { useEntitlements } from '@/hooks/use-entitlements'

import type { Practitioner } from '@/types/database'

interface UnpaidInvoice {
  id: string
  invoice_number: string
  amount: number
  issued_at: string | null
  patientName: string | null
}

interface DashboardProps {
  practitioner: Practitioner
  practitionerEmail: string
  stats: {
    totalPatients: number
    todayConsultations: number
    monthlyRevenue: number
    unreadMessages: number
    surveysToRead: number
    followUpsDue: number
  }
  recentConsultations: Array<{
    id: string
    date_time: string
    reason: string
    patient: { id: string; first_name: string; last_name: string } | null
  }>
  unpaidInvoices: UnpaidInvoice[]
}

/**
 * Widgets secondaires, sous le bloc principal. Chacun peut être masqué :
 * le choix est mémorisé sur ce poste uniquement.
 */
type OptionalWidget = 'relaunch' | 'osteoupgrade' | 'video' | 'progress' | 'weather'

const OPTIONAL_WIDGETS: Array<{ id: OptionalWidget; label: string; needsOsteoUpgrade?: boolean }> = [
  { id: 'relaunch', label: 'Relances patients' },
  { id: 'osteoupgrade', label: 'Revue et formation à la une', needsOsteoUpgrade: true },
  { id: 'video', label: 'Vidéo de pratique', needsOsteoUpgrade: true },
  { id: 'progress', label: 'Progression' },
  { id: 'weather', label: 'Météo' },
]

const DEFAULT_HIDDEN: OptionalWidget[] = ['video', 'progress', 'weather']
const HIDDEN_WIDGETS_KEY = 'myosteoflow_dashboard_hidden_widgets'

function greeting() {
  const h = new Date().getHours()
  if (h < 18) return 'Bonjour'
  return 'Bonsoir'
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000))
}

export function Dashboard({ practitioner, practitionerEmail, stats, unpaidInvoices }: DashboardProps) {
  // L'offre MyOsteoFlow seule n'inclut pas le contenu OsteoUpgrade : ses
  // endpoints répondent 403. On remplace les widgets par un encart d'offre
  // plutôt que d'afficher des cartes vides.
  const { osteoupgrade: aOsteoUpgrade } = useEntitlements()
  const [widgets, setWidgets] = useState<WidgetsData | null>(null)
  const [widgetsLoading, setWidgetsLoading] = useState(true)
  const [widgetsRefreshKey, setWidgetsRefreshKey] = useState(0)
  const [hidden, setHidden] = useState<OptionalWidget[]>(DEFAULT_HIDDEN)
  const [today, setToday] = useState<TodaySummary | null>(null)
  const onSummary = useCallback((summary: TodaySummary) => setToday(summary), [])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HIDDEN_WIDGETS_KEY)
      if (stored) setHidden(JSON.parse(stored) as OptionalWidget[])
    } catch {
      // Stockage indisponible : on garde les valeurs par défaut.
    }
  }, [])

  const toggleWidget = (id: OptionalWidget, visible: boolean) => {
    setHidden((previous) => {
      const next = visible ? previous.filter((w) => w !== id) : [...previous, id]
      try {
        localStorage.setItem(HIDDEN_WIDGETS_KEY, JSON.stringify(next))
      } catch {
        // Le choix vaut alors pour la session en cours seulement.
      }
      return next
    })
  }

  const availableWidgets = OPTIONAL_WIDGETS.filter((w) => !w.needsOsteoUpgrade || aOsteoUpgrade)
  const isShown = (id: OptionalWidget) =>
    !hidden.includes(id) && availableWidgets.some((w) => w.id === id)
  const hiddenLabels = availableWidgets.filter((w) => hidden.includes(w.id)).map((w) => w.label.toLowerCase())

  useEffect(() => {
    if (!aOsteoUpgrade || !isShown('osteoupgrade')) return
    setWidgetsLoading(true)
    fetch('/api/osteoupgrade-widgets', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setWidgets)
      .catch(() => setWidgets(null))
      .finally(() => setWidgetsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetsRefreshKey, aOsteoUpgrade, hidden])

  const country = practitioner.country
  const unpaidTotal = unpaidInvoices.reduce((sum, invoice) => sum + invoice.amount, 0)

  const kpis = [
    {
      label: 'Séances aujourd’hui',
      value: String(Math.max(stats.todayConsultations, today?.total ?? 0)),
      note: today && today.total > 0 ? `${today.done} sur ${today.total} vus` : 'Ma journée non préparée',
      href: '/day-plan',
    },
    {
      label: 'Encaissé ce mois',
      value: formatCurrency(stats.monthlyRevenue, country),
      note: 'Factures réglées',
      href: '/accounting',
    },
    {
      label: 'Factures impayées',
      value: String(unpaidInvoices.length),
      note: unpaidInvoices.length > 0 ? `${formatCurrency(unpaidTotal, country)} en attente` : 'Tout est réglé',
      tone: unpaidInvoices.length > 0 ? 'warning' : 'success',
      href: '/invoices?status=issued',
    },
    {
      label: 'Messages non lus',
      value: String(stats.unreadMessages),
      note: stats.unreadMessages > 0 ? 'Conversations patients' : 'Rien en attente',
      href: '/messages',
    },
  ] as const

  const todo: Array<{ key: string; title: string; sub: string; cta: string; href: string; tone: 'warning' | 'info' }> = [
    ...unpaidInvoices.slice(0, 3).map((invoice) => {
      const days = daysSince(invoice.issued_at)
      return {
        key: invoice.id,
        title: `Facture n° ${invoice.invoice_number} impayée`,
        sub: [invoice.patientName, formatCurrency(invoice.amount, country), days !== null ? `${days} j` : null]
          .filter(Boolean)
          .join(' · '),
        cta: 'Voir',
        href: `/invoices/${invoice.id}`,
        tone: 'warning' as const,
      }
    }),
    ...(unpaidInvoices.length > 3
      ? [{
          key: 'more-invoices',
          title: `${unpaidInvoices.length - 3} autre${unpaidInvoices.length - 3 > 1 ? 's' : ''} facture${unpaidInvoices.length - 3 > 1 ? 's' : ''} impayée${unpaidInvoices.length - 3 > 1 ? 's' : ''}`,
          sub: 'Liste complète des impayés',
          cta: 'Ouvrir',
          href: '/invoices?status=issued',
          tone: 'warning' as const,
        }]
      : []),
    ...(stats.followUpsDue > 0
      ? [{
          key: 'follow-ups',
          title: `${stats.followUpsDue} suivi${stats.followUpsDue > 1 ? 's' : ''} J+7 prévu${stats.followUpsDue > 1 ? 's' : ''} aujourd’hui`,
          sub: 'Emails programmés',
          cta: 'Vérifier',
          href: '/scheduled-emails',
          tone: 'info' as const,
        }]
      : []),
    ...(stats.surveysToRead > 0
      ? [{
          key: 'surveys',
          title: `${stats.surveysToRead} questionnaire${stats.surveysToRead > 1 ? 's' : ''} reçu${stats.surveysToRead > 1 ? 's' : ''}`,
          sub: 'Suivi patients',
          cta: 'Lire',
          href: '/surveys',
          tone: 'info' as const,
        }]
      : []),
  ]

  const summaryLine = today
    ? today.total === 0
      ? 'Aucun patient préparé pour aujourd’hui.'
      : today.next
        ? `${today.total} patient${today.total > 1 ? 's' : ''} aujourd’hui. Prochain : ${today.next.first_name} ${today.next.last_name}.`
        : `${today.total} patient${today.total > 1 ? 's' : ''} aujourd’hui, tous vus. Belle journée !`
    : ' '

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
      <ProfileCompletionWidget />

      {/* ── Accueil ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            {greeting()} {practitioner.first_name}
          </h2>
          <p className="text-[15px] text-muted-foreground">{summaryLine}</p>
        </div>
        <div className="flex items-center gap-3">
          {isShown('weather') && <HeaderWeather />}
          <Button
            className="gap-2"
            onClick={() => openCommandPalette('consultation')}
            data-tour="dashboard-new-consult"
          >
            <Plus className="h-4 w-4" />
            Nouvelle consultation
          </Button>
        </div>
      </div>

      {/* ── Chiffres du jour ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Link key={kpi.label} href={kpi.href} className="stat-card flex flex-col gap-1.5 !p-4 sm:!p-5">
            <span className="text-[13px] font-medium text-muted-foreground">{kpi.label}</span>
            <span className="text-2xl font-semibold tabular-nums tracking-tight">{kpi.value}</span>
            <span
              className={cn(
                'text-[13px]',
                'tone' in kpi && kpi.tone === 'warning' && 'text-warning',
                'tone' in kpi && kpi.tone === 'success' && 'text-success',
                !('tone' in kpi) && 'text-muted-foreground'
              )}
            >
              {kpi.note}
            </span>
          </Link>
        ))}
      </div>

      {/* ── Aujourd'hui | À traiter ── */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TodayPanel onSummary={onSummary} />
        </div>

        <div className="flex flex-col gap-6">
          <section className="glass-card rounded-xl" aria-labelledby="todo-title">
            <div className="border-b border-border px-5 py-4">
              <h2 id="todo-title" className="text-base font-semibold">À traiter</h2>
            </div>
            {todo.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">Rien en attente. Tout est à jour.</p>
            ) : (
              <ul className="py-2">
                {todo.map((item) => (
                  <li key={item.key} className="flex items-center gap-3 px-5 py-2.5">
                    <span
                      aria-hidden="true"
                      className={cn('h-2 w-2 shrink-0 rounded-full', item.tone === 'warning' ? 'bg-warning' : 'bg-primary')}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      <span className="block truncate text-[13px] text-muted-foreground">{item.sub}</span>
                    </span>
                    <Button variant="outline" size="sm" className="h-8 shrink-0" asChild>
                      <Link href={item.href}>{item.cta}</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {aOsteoUpgrade ? <FlashcardsWidget /> : <OsteoUpgradeUpsellWidget />}
        </div>
      </div>

      {/* ── Widgets secondaires ── */}
      {isShown('progress') && <ProgressWidget layout="horizontal" />}

      {(isShown('relaunch') || isShown('osteoupgrade') || isShown('video')) && (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          {isShown('osteoupgrade') && (
            <div className="flex flex-col gap-6">
              <ReviewWidget
                review={widgets?.review ?? null}
                loading={widgetsLoading}
                onRefresh={() => setWidgetsRefreshKey((k) => k + 1)}
              />
              <FeaturedFormationWidget
                formation={widgets?.featured_formation ?? null}
                loading={widgetsLoading}
                practitionerEmail={practitionerEmail}
              />
            </div>
          )}
          {isShown('video') && (
            <div className="lg:col-span-2">
              <VideoWidget />
            </div>
          )}
          {isShown('relaunch') && (
            <div className={cn(!isShown('video') && !isShown('osteoupgrade') ? 'lg:col-span-3' : !isShown('video') ? 'lg:col-span-2' : '')}>
              <RelaunchWidget />
            </div>
          )}
        </div>
      )}

      {/* ── Personnalisation ── */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
        {hiddenLabels.length > 0 && (
          <span>
            {hiddenLabels.length === 1 ? 'Masqué' : 'Masqués'} : {hiddenLabels.join(', ')}.
          </span>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="inline-flex items-center gap-1.5 font-medium text-accent-foreground hover:underline">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Personnaliser le tableau de bord
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-3">
            <p className="mb-2 text-sm font-semibold">Widgets affichés</p>
            <div className="space-y-1">
              {availableWidgets.map((widget) => (
                <label key={widget.id} className="flex min-h-9 cursor-pointer items-center gap-3 rounded-md px-2 text-sm hover:bg-muted">
                  <Checkbox
                    checked={!hidden.includes(widget.id)}
                    onCheckedChange={(checked) => toggleWidget(widget.id, checked === true)}
                  />
                  {widget.label}
                </label>
              ))}
            </div>
            {!aOsteoUpgrade && (
              <p className="mt-3 flex items-start gap-2 rounded-md ai-surface p-2 text-xs text-muted-foreground">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ai" />
                Les widgets de formation sont inclus avec OsteoUpgrade.
              </p>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
