'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search, CheckCircle2, XCircle, HelpCircle, X, ChevronDown, ChevronUp } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface OrthoTest {
  id: string
  name: string
  category: string | null
  indications: string | null
  region: string | null
  clusters: string[]
}

type TestResult = 'positive' | 'negative' | 'uncertain' | null

interface SelectedTest {
  test: OrthoTest
  result: TestResult
}

interface OrthoTestsPickerDialogProps {
  open: boolean
  onClose: () => void
  onInject: (text: string) => void
}

const RESULT_CONFIG = {
  positive: {
    label: 'Positif',
    color: 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500',
    inactive: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400',
    cardBg: 'border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/40',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    symbol: '✅',
  },
  negative: {
    label: 'Négatif',
    color: 'bg-rose-500 hover:bg-rose-600 text-white border-rose-500',
    inactive: 'border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-400',
    cardBg: 'border-rose-400 bg-rose-50/60 dark:bg-rose-950/40',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
    symbol: '❌',
  },
  uncertain: {
    label: 'Incertain',
    color: 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500',
    inactive: 'border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400',
    cardBg: 'border-amber-400 bg-amber-50/60 dark:bg-amber-950/40',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    symbol: '⚠️',
  },
} as const

export function OrthoTestsPickerDialog({ open, onClose, onInject }: OrthoTestsPickerDialogProps) {
  const { toast } = useToast()
  const [tests, setTests] = useState<OrthoTest[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [regionFilter, setRegionFilter] = useState<string | null>(null)
  const [selected, setSelected] = useState<Map<string, SelectedTest>>(new Map())
  const [showSelected, setShowSelected] = useState(true)

  useEffect(() => {
    if (!open) return
    if (tests.length > 0) return
    setLoading(true)
    fetch('/api/ortho-tests')
      .then(r => r.json())
      .then(data => {
        if (data.tests) setTests(data.tests)
        else toast({ title: 'Erreur lors du chargement des tests', variant: 'destructive' })
      })
      .catch(() => toast({ title: 'Impossible de charger les tests', variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [open, tests.length, toast])

  const regions = useMemo(() => {
    const set = new Set<string>()
    for (const t of tests) if (t.region) set.add(t.region)
    return Array.from(set).sort()
  }, [tests])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return tests.filter(t => {
      if (regionFilter && t.region !== regionFilter) return false
      if (!q) return true
      return (
        t.name.toLowerCase().includes(q) ||
        (t.indications?.toLowerCase().includes(q) ?? false) ||
        (t.region?.toLowerCase().includes(q) ?? false) ||
        t.clusters.some(c => c.toLowerCase().includes(q))
      )
    })
  }, [tests, query, regionFilter])

  const selectedList = useMemo(() => Array.from(selected.values()), [selected])

  function toggleSelect(test: OrthoTest) {
    setSelected(prev => {
      const next = new Map(prev)
      if (next.has(test.id)) {
        next.delete(test.id)
      } else {
        next.set(test.id, { test, result: null })
      }
      return next
    })
  }

  function setResult(testId: string, result: TestResult) {
    setSelected(prev => {
      const entry = prev.get(testId)
      if (!entry) return prev
      const next = new Map(prev)
      // clicking same result deselects it
      next.set(testId, { ...entry, result: entry.result === result ? null : result })
      return next
    })
  }

  function removeSelected(testId: string) {
    setSelected(prev => {
      const next = new Map(prev)
      next.delete(testId)
      return next
    })
  }

  function handleInject() {
    if (selected.size === 0) return
    const lines: string[] = ['Tests réalisés :']
    for (const { test, result } of selectedList) {
      const cfg = result ? RESULT_CONFIG[result] : null
      const symbol = cfg ? `${cfg.symbol} ` : '• '
      const label = result ? ` — ${cfg!.label.toLowerCase()}` : ''
      lines.push(`${symbol}${test.name}${label}`)
    }
    onInject(lines.join('\n'))
    handleClose()
  }

  function handleClose() {
    onClose()
    setSelected(new Map())
    setQuery('')
    setRegionFilter(null)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-2xl h-[88vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 shrink-0">
          <DialogTitle>Tests orthopédiques</DialogTitle>
          <DialogDescription>
            Sélectionnez les tests effectués, indiquez leur résultat, puis injectez dans l&apos;examen clinique.
          </DialogDescription>
        </DialogHeader>

        {/* Search + region filters */}
        <div className="px-6 pb-3 space-y-2 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9"
              placeholder="Nom, indication, cluster…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          {regions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setRegionFilter(null)}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                  regionFilter === null
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-muted'
                }`}
              >
                Toutes
              </button>
              {regions.map(r => (
                <button
                  key={r}
                  onClick={() => setRegionFilter(prev => prev === r ? null : r)}
                  className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                    regionFilter === r
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Test list */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-1.5 min-h-0">
          {loading && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun test trouvé.</p>
          )}
          {!loading && filtered.map(test => {
            const sel = selected.get(test.id)
            const resultCfg = sel?.result ? RESULT_CONFIG[sel.result] : null
            return (
              <div
                key={test.id}
                className={`rounded-lg border p-3 transition-colors ${
                  sel
                    ? resultCfg ? resultCfg.cardBg : 'border-primary/50 bg-primary/5'
                    : 'border-border hover:bg-muted/50 cursor-pointer'
                }`}
                onClick={() => { if (!sel) toggleSelect(test) }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{test.name}</p>
                    {test.indications && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{test.indications}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {test.region && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{test.region}</Badge>
                      )}
                      {test.clusters.slice(0, 2).map(c => (
                        <Badge key={c} variant="outline" className="text-[10px] px-1.5 py-0">{c}</Badge>
                      ))}
                    </div>
                  </div>
                  {sel ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(['positive', 'negative', 'uncertain'] as const).map(r => {
                        const cfg = RESULT_CONFIG[r]
                        const active = sel.result === r
                        return (
                          <button
                            key={r}
                            onClick={e => { e.stopPropagation(); setResult(test.id, r) }}
                            className={`text-[11px] font-semibold px-2 py-1 rounded border transition-colors ${
                              active ? cfg.color : `bg-transparent ${cfg.inactive}`
                            }`}
                            title={cfg.label}
                          >
                            {r === 'positive' && <CheckCircle2 className="h-3 w-3 inline mr-0.5 -mt-px" />}
                            {r === 'negative' && <XCircle className="h-3 w-3 inline mr-0.5 -mt-px" />}
                            {r === 'uncertain' && <HelpCircle className="h-3 w-3 inline mr-0.5 -mt-px" />}
                            {cfg.label}
                          </button>
                        )
                      })}
                      <button
                        onClick={e => { e.stopPropagation(); removeSelected(test.id) }}
                        className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
                        title="Retirer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>

        {/* Selected summary */}
        {selectedList.length > 0 && (
          <div className="border-t bg-muted/30 shrink-0">
            <button
              className="w-full flex items-center justify-between px-6 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowSelected(v => !v)}
            >
              <span>{selectedList.length} test{selectedList.length > 1 ? 's' : ''} sélectionné{selectedList.length > 1 ? 's' : ''}</span>
              {showSelected ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
            {showSelected && (
              <div className="px-6 pb-3 flex flex-wrap gap-1.5">
                {selectedList.map(({ test, result }) => {
                  const cfg = result ? RESULT_CONFIG[result] : null
                  return (
                    <span
                      key={test.id}
                      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border font-medium ${
                        cfg ? cfg.badge + ' border-transparent' : 'bg-muted border-border'
                      }`}
                    >
                      {cfg?.symbol} {test.name}
                      {result && <span className="opacity-70">· {cfg!.label.toLowerCase()}</span>}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={handleClose}>Annuler</Button>
          <Button
            disabled={selected.size === 0}
            onClick={handleInject}
            className="gap-1.5"
          >
            Injecter dans l&apos;examen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
