'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowDown,
  ArrowUp,
  Check,
  EyeOff,
  GripVertical,
  LayoutGrid,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, formatCurrency } from '@/lib/utils'

import { VideoWidget } from './widgets/video-widget'
import { ProgressWidget } from './widgets/progress-widget'
import { ReviewWidget, FeaturedFormationWidget, type WidgetsData } from './widgets/osteoupgrade-widgets'
import { FlashcardsWidget } from './widgets/flashcards-widget'
import { OsteoUpgradeUpsellWidget } from './widgets/osteoupgrade-upsell'
import { RelaunchWidget } from './widgets/relaunch-widget'
import { ProfileCompletionWidget } from './profile-completion-widget'
import { TodayPanel, type TodaySummary } from './today-panel'
import { WeekAgendaPanel } from './week-agenda-panel'
import { useDoctolibFeature } from '@/lib/doctolib/use-doctolib-feature'
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
 * Le tableau de bord est une grille de blocs que chacun range à sa façon :
 * ordre, largeur (1, 2 ou 3 colonnes) et visibilité. La disposition est
 * mémorisée sur ce poste.
 */
type BlockId = 'today' | 'agenda' | 'todo' | 'osteoupgrade' | 'review' | 'video' | 'relaunch' | 'progress'
type BlockSize = 1 | 2 | 3

interface BlockLayout {
  id: BlockId
  size: BlockSize
  hidden: boolean
}

const BLOCKS: Record<BlockId, { label: string; needsOsteoUpgrade?: boolean; needsDoctolib?: boolean; visibleWhenNew?: boolean }> = {
  today: { label: 'Aujourd’hui' },
  agenda: { label: 'Agenda de la semaine', needsDoctolib: true, visibleWhenNew: true },
  todo: { label: 'À traiter' },
  osteoupgrade: { label: 'OsteoFlash' },
  review: { label: 'Revue et formation à la une', needsOsteoUpgrade: true },
  video: { label: 'Vidéo de pratique', needsOsteoUpgrade: true },
  relaunch: { label: 'Relances patients' },
  progress: { label: 'Progression' },
}

const DEFAULT_LAYOUT: BlockLayout[] = [
  { id: 'today', size: 2, hidden: false },
  { id: 'todo', size: 1, hidden: false },
  { id: 'agenda', size: 3, hidden: false },
  { id: 'relaunch', size: 2, hidden: false },
  { id: 'osteoupgrade', size: 1, hidden: false },
  { id: 'review', size: 1, hidden: false },
  { id: 'video', size: 2, hidden: true },
  { id: 'progress', size: 3, hidden: true },
]

const LAYOUT_KEY = 'myosteoflow_dashboard_layout_v1'
const TIP_DISMISSED_KEY = 'myosteoflow_dashboard_layout_tip_dismissed'

const SIZE_CLASS: Record<BlockSize, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
}

const SIZE_LABEL: Record<BlockSize, string> = {
  1: 'Étroit',
  2: 'Large',
  3: 'Pleine largeur',
}

/** Complète une disposition enregistrée avec les blocs ajoutés depuis. */
function mergeLayout(stored: unknown): BlockLayout[] {
  if (!Array.isArray(stored)) return DEFAULT_LAYOUT
  const known = stored.filter(
    (entry): entry is BlockLayout =>
      !!entry && typeof entry === 'object' && (entry as BlockLayout).id in BLOCKS && [1, 2, 3].includes((entry as BlockLayout).size)
  )
  const seen = new Set(known.map((entry) => entry.id))
  return [
    ...known.filter((entry, index) => known.findIndex((other) => other.id === entry.id) === index),
    ...DEFAULT_LAYOUT.filter((entry) => !seen.has(entry.id)).map((entry) => ({ ...entry, hidden: !BLOCKS[entry.id].visibleWhenNew })),
  ]
}

function greeting() {
  return new Date().getHours() < 18 ? 'Bonjour' : 'Bonsoir'
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000))
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Stockage indisponible : le choix vaut pour la session en cours.
  }
}

export function Dashboard({ practitioner, practitionerEmail, stats, unpaidInvoices }: DashboardProps) {
  // L'offre MyOsteoFlow seule n'inclut pas le contenu OsteoUpgrade : ses
  // endpoints répondent 403. On remplace les widgets par un encart d'offre
  // plutôt que d'afficher des cartes vides.
  const { osteoupgrade: aOsteoUpgrade } = useEntitlements()
  const doctolibVisible = useDoctolibFeature()
  const [widgets, setWidgets] = useState<WidgetsData | null>(null)
  const [widgetsLoading, setWidgetsLoading] = useState(true)
  const [widgetsRefreshKey, setWidgetsRefreshKey] = useState(0)
  const [today, setToday] = useState<TodaySummary | null>(null)
  const onSummary = useCallback((summary: TodaySummary) => setToday(summary), [])

  const [layout, setLayout] = useState<BlockLayout[]>(DEFAULT_LAYOUT)
  const [editing, setEditing] = useState(false)
  const [showTip, setShowTip] = useState(false)
  const [dragId, setDragId] = useState<BlockId | null>(null)
  const [dropTarget, setDropTarget] = useState<BlockId | null>(null)

  useEffect(() => {
    const stored = readStorage(LAYOUT_KEY)
    if (stored) {
      try {
        setLayout(mergeLayout(JSON.parse(stored)))
      } catch {
        // Disposition illisible : on garde celle par défaut.
      }
    }
    setShowTip(readStorage(TIP_DISMISSED_KEY) !== '1')
  }, [])

  const saveLayout = (next: BlockLayout[]) => {
    setLayout(next)
    writeStorage(LAYOUT_KEY, JSON.stringify(next))
  }

  const blockLabel = (id: BlockId) =>
    id === 'osteoupgrade' && !aOsteoUpgrade ? 'Offre OsteoUpgrade' : BLOCKS[id].label

  const isAvailable = (id: BlockId) =>
    (!BLOCKS[id].needsOsteoUpgrade || aOsteoUpgrade) && (!BLOCKS[id].needsDoctolib || doctolibVisible)
  const available = useMemo(
    () => layout.filter((block) => isAvailable(block.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layout, aOsteoUpgrade, doctolibVisible]
  )
  const visible = available.filter((block) => !block.hidden)
  const hiddenBlocks = available.filter((block) => block.hidden)
  const reviewShown = visible.some((block) => block.id === 'review')

  useEffect(() => {
    if (!aOsteoUpgrade || !reviewShown) return
    setWidgetsLoading(true)
    fetch('/api/osteoupgrade-widgets', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setWidgets)
      .catch(() => setWidgets(null))
      .finally(() => setWidgetsLoading(false))
  }, [widgetsRefreshKey, aOsteoUpgrade, reviewShown])

  const updateBlock = (id: BlockId, change: Partial<BlockLayout>) =>
    saveLayout(layout.map((block) => (block.id === id ? { ...block, ...change } : block)))

  /** Déplace un bloc d'un cran parmi les blocs affichés */
  const moveBy = (id: BlockId, delta: -1 | 1) => {
    const order = visible.map((block) => block.id)
    const index = order.indexOf(id)
    const target = order[index + delta]
    if (!target) return
    moveBefore(id, target, delta === 1)
  }

  /** Place `id` juste avant (ou après) `target` */
  const moveBefore = (id: BlockId, target: BlockId, after = false) => {
    if (id === target) return
    const moving = layout.find((block) => block.id === id)
    if (!moving) return
    const rest = layout.filter((block) => block.id !== id)
    const targetIndex = rest.findIndex((block) => block.id === target)
    rest.splice(after ? targetIndex + 1 : targetIndex, 0, moving)
    saveLayout(rest)
  }

  const startEditing = () => {
    setEditing(true)
    setShowTip(false)
    writeStorage(TIP_DISMISSED_KEY, '1')
  }

  const country = practitioner.country

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
          sub: `${formatCurrency(unpaidInvoices.reduce((sum, invoice) => sum + invoice.amount, 0), country)} en attente au total`,
          cta: 'Ouvrir',
          href: '/invoices?status=issued',
          tone: 'warning' as const,
        }]
      : []),
    ...(stats.unreadMessages > 0
      ? [{
          key: 'messages',
          title: `${stats.unreadMessages} conversation${stats.unreadMessages > 1 ? 's' : ''} non lue${stats.unreadMessages > 1 ? 's' : ''}`,
          sub: 'Messagerie',
          cta: 'Lire',
          href: '/messages',
          tone: 'info' as const,
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
        ? `${today.total} patient${today.total > 1 ? 's' : ''} aujourd’hui, ${today.done} vu${today.done > 1 ? 's' : ''}. Prochain : ${today.next.first_name} ${today.next.last_name}.`
        : `${today.total} patient${today.total > 1 ? 's' : ''} aujourd’hui, tous vus. Belle journée !`
    : ' '

  const renderBlock = (block: BlockLayout) => {
    switch (block.id) {
      case 'today':
        return <TodayPanel onSummary={onSummary} />
      case 'agenda':
        return <WeekAgendaPanel size={block.size} />
      case 'todo':
        return (
          <section className="glass-card rounded-xl" aria-labelledby="todo-title">
            <div className="card-head border-b px-5 py-4">
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
        )
      case 'osteoupgrade':
        return aOsteoUpgrade ? <FlashcardsWidget /> : <OsteoUpgradeUpsellWidget />
      case 'review':
        return (
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
        )
      case 'video':
        return <VideoWidget />
      case 'relaunch':
        return <RelaunchWidget />
      case 'progress':
        return <ProgressWidget layout={block.size === 1 ? 'vertical' : 'horizontal'} />
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
      <ProfileCompletionWidget />

      {/* ── Accueil ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">
              {greeting()} {practitioner.first_name}
            </h2>
            <HeaderWeather variant="greeting" />
          </div>
          <p className="text-[15px] text-muted-foreground">{summaryLine}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!editing && (
            <Button variant="outline" className="gap-2 border-primary/40 text-accent-foreground hover:bg-accent" onClick={startEditing} data-tour="dashboard-organize">
              <LayoutGrid className="h-4 w-4" />
              Organiser
            </Button>
          )}
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

      {/* ── Astuce affichée tant qu'on n'a pas essayé ── */}
      {showTip && !editing && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-accent px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card text-accent-foreground">
            <LayoutGrid className="h-[18px] w-[18px]" />
          </span>
          <p className="min-w-0 flex-1 basis-64 text-sm text-accent-foreground">
            <span className="font-semibold">Votre tableau de bord, à votre façon.</span>{' '}
            Déplacez les blocs, choisissez leur largeur et masquez ceux qui ne vous servent pas.
          </p>
          <Button size="sm" onClick={startEditing}>Organiser maintenant</Button>
          <button
            type="button"
            aria-label="Masquer l’astuce"
            onClick={() => {
              setShowTip(false)
              writeStorage(TIP_DISMISSED_KEY, '1')
            }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-accent-foreground/70 hover:bg-card hover:text-accent-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Barre du mode organisation ── */}
      {editing && (
        <div className="sticky top-[calc(4rem+var(--app-tabs-h,0px))] z-20 -mx-1 px-1 py-1 bg-background">
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-primary px-4 py-3 text-primary-foreground shadow-lg">
            <LayoutGrid className="h-5 w-5 shrink-0" />
            <p className="min-w-0 flex-1 basis-64 text-sm">
              <span className="font-semibold">Mode organisation.</span>{' '}
              Glissez un bloc par sa poignée, ou utilisez les flèches. Changez sa largeur ou masquez-le.
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
              onClick={() => saveLayout(DEFAULT_LAYOUT)}
            >
              <RotateCcw className="h-4 w-4" />
              Réinitialiser
            </Button>
            <Button size="sm" className="gap-1.5 bg-card text-accent-foreground hover:bg-card/90" onClick={() => setEditing(false)}>
              <Check className="h-4 w-4" />
              Terminer
            </Button>
          </div>

          {hiddenBlocks.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-card px-4 py-2.5">
              <span className="text-sm font-medium text-muted-foreground">Blocs masqués :</span>
              {hiddenBlocks.map((block) => (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => updateBlock(block.id, { hidden: false })}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-input bg-card px-3 text-sm font-medium hover:border-primary hover:bg-accent hover:text-accent-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {blockLabel(block.id)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Blocs ── */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3 [grid-auto-flow:dense]">
        {visible.map((block, index) => (
          <div
            key={block.id}
            className={cn(
              SIZE_CLASS[block.size],
              'min-w-0',
              editing && 'relative rounded-2xl border-2 border-dashed border-primary/40 bg-accent/40 p-2 pt-12 transition-colors',
              editing && dropTarget === block.id && dragId !== block.id && 'border-primary bg-accent',
              editing && dragId === block.id && 'opacity-50'
            )}
            onDragOver={(event) => {
              if (!editing || !dragId) return
              event.preventDefault()
              setDropTarget(block.id)
            }}
            onDragLeave={() => setDropTarget((current) => (current === block.id ? null : current))}
            onDrop={(event) => {
              event.preventDefault()
              if (dragId) {
                const from = visible.findIndex((b) => b.id === dragId)
                moveBefore(dragId, block.id, from < index)
              }
              setDragId(null)
              setDropTarget(null)
            }}
          >
            {editing && (
              <div className="absolute inset-x-2 top-2 flex items-center gap-1 rounded-lg bg-card px-1.5 py-1 shadow-sm">
                <span
                  draggable
                  onDragStart={(event) => {
                    setDragId(block.id)
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', block.id)
                  }}
                  onDragEnd={() => {
                    setDragId(null)
                    setDropTarget(null)
                  }}
                  title="Glisser pour déplacer"
                  className="flex h-8 w-8 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
                >
                  <GripVertical className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{blockLabel(block.id)}</span>
                <button
                  type="button"
                  onClick={() => moveBy(block.id, -1)}
                  disabled={index === 0}
                  aria-label={`Monter le bloc ${blockLabel(block.id)}`}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveBy(block.id, 1)}
                  disabled={index === visible.length - 1}
                  aria-label={`Descendre le bloc ${blockLabel(block.id)}`}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <div role="group" aria-label="Largeur du bloc" className="hidden lg:flex rounded-md border border-input p-0.5">
                  {([1, 2, 3] as BlockSize[]).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => updateBlock(block.id, { size })}
                      aria-pressed={block.size === size}
                      title={SIZE_LABEL[size]}
                      className={cn(
                        'h-7 rounded px-2 text-xs font-medium',
                        block.size === size ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {size === 3 ? 'Plein' : `${size}/3`}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => updateBlock(block.id, { hidden: true })}
                  aria-label={`Masquer le bloc ${blockLabel(block.id)}`}
                  title="Masquer"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <EyeOff className="h-4 w-4" />
                </button>
              </div>
            )}
            {/* En organisation, le contenu ne réagit plus aux clics : on range, on n'agit pas */}
            <div className={cn(editing && 'pointer-events-none select-none')} aria-hidden={editing || undefined}>
              {renderBlock(block)}
            </div>
          </div>
        ))}
      </div>

      {!editing && (
        <button
          type="button"
          onClick={startEditing}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-accent-foreground"
        >
          <LayoutGrid className="h-4 w-4" />
          Organiser le tableau de bord
          {hiddenBlocks.length > 0 && (
            <span className="font-normal">
              · {hiddenBlocks.length} bloc{hiddenBlocks.length > 1 ? 's' : ''} masqué{hiddenBlocks.length > 1 ? 's' : ''} à ajouter
            </span>
          )}
        </button>
      )}
    </div>
  )
}
