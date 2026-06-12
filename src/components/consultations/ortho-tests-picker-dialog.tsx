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
import { Loader2, Search, CheckCircle2, XCircle, HelpCircle, X, ChevronDown, ChevronRight } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface OrthoTest {
  id: string
  name: string
  region: string | null
  indications: string | null
  clusters: string[]
}

interface OrthoCluster {
  id: string
  name: string
  region: string | null
  tests: { id: string; name: string; region: string | null; indications: string | null }[]
}

type TestResult = 'positive' | 'negative' | 'uncertain' | null

interface SelectedTest {
  test: OrthoTest
  result: TestResult
  /** Cluster this test was added from (via "Tout sélectionner"), if any */
  fromClusterId: string | null
}

interface OrthoTestsPickerDialogProps {
  open: boolean
  onClose: () => void
  onInject: (text: string) => void
  initialRegion?: string
}

const RESULT_CONFIG = {
  positive: {
    label: 'Positif',
    activeCls: 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500',
    inactiveCls: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400',
    cardBg: 'border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/40',
    badge: 'bg-emerald-100 text-emerald-700 border-transparent dark:bg-emerald-900/50 dark:text-emerald-300',
    symbol: '✅',
    Icon: CheckCircle2,
  },
  negative: {
    label: 'Négatif',
    activeCls: 'bg-rose-500 hover:bg-rose-600 text-white border-rose-500',
    inactiveCls: 'border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-400',
    cardBg: 'border-rose-400 bg-rose-50/60 dark:bg-rose-950/40',
    badge: 'bg-rose-100 text-rose-700 border-transparent dark:bg-rose-900/50 dark:text-rose-300',
    symbol: '❌',
    Icon: XCircle,
  },
  uncertain: {
    label: 'Incertain',
    activeCls: 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500',
    inactiveCls: 'border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400',
    cardBg: 'border-amber-400 bg-amber-50/60 dark:bg-amber-950/40',
    badge: 'bg-amber-100 text-amber-700 border-transparent dark:bg-amber-900/50 dark:text-amber-300',
    symbol: '⚠️',
    Icon: HelpCircle,
  },
} as const

type Mode = 'tests' | 'clusters'

/** Normalize a string for accent- and case-insensitive comparison */
function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function ResultButtons({ testId, result, onSet, onRemove }: {
  testId: string
  result: TestResult
  onSet: (id: string, r: TestResult) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      {(['positive', 'negative', 'uncertain'] as const).map(r => {
        const cfg = RESULT_CONFIG[r]
        const active = result === r
        return (
          <button
            key={r}
            onClick={e => { e.stopPropagation(); onSet(testId, active ? null : r) }}
            className={`text-[11px] font-semibold px-2 py-1 rounded border transition-colors flex items-center gap-0.5 ${
              active ? cfg.activeCls : `bg-transparent ${cfg.inactiveCls}`
            }`}
          >
            <cfg.Icon className="h-3 w-3" />
            {cfg.label}
          </button>
        )
      })}
      <button
        onClick={e => { e.stopPropagation(); onRemove(testId) }}
        className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
        title="Retirer"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function OrthoTestsPickerDialog({ open, onClose, onInject, initialRegion }: OrthoTestsPickerDialogProps) {
  const { toast } = useToast()
  const [tests, setTests] = useState<OrthoTest[]>([])
  const [clusters, setClusters] = useState<OrthoCluster[]>([])
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<Mode>('tests')
  const [query, setQuery] = useState('')
  const [regionFilter, setRegionFilter] = useState<string | null>(null)
  const [selected, setSelected] = useState<Map<string, SelectedTest>>(new Map())
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (open && initialRegion) setRegionFilter(initialRegion)
  }, [open, initialRegion])

  useEffect(() => {
    if (!open) return
    if (tests.length > 0) return
    setLoading(true)
    fetch('/api/ortho-tests')
      .then(r => r.json())
      .then(data => {
        if (data.tests) setTests(data.tests)
        if (data.clusters) setClusters(data.clusters)
        if (!data.tests) toast({ title: 'Erreur lors du chargement des tests', variant: 'destructive' })
      })
      .catch(() => toast({ title: 'Impossible de charger les tests', variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [open, tests.length, toast])

  const regions = useMemo(() => {
    const set = new Set<string>()
    for (const t of tests) if (t.region) set.add(t.region)
    return Array.from(set).sort()
  }, [tests])

  const filteredTests = useMemo(() => {
    const q = normalize(query.trim())
    return tests.filter(t => {
      if (regionFilter && t.region !== regionFilter) return false
      if (!q) return true
      return (
        normalize(t.name).includes(q) ||
        normalize(t.indications ?? '').includes(q) ||
        normalize(t.region ?? '').includes(q) ||
        t.clusters.some(c => normalize(c).includes(q))
      )
    })
  }, [tests, query, regionFilter])

  const filteredClusters = useMemo(() => {
    const q = normalize(query.trim())
    return clusters.filter(c => {
      if (!q) return true
      return (
        normalize(c.name).includes(q) ||
        normalize(c.region ?? '').includes(q) ||
        c.tests.some(t => normalize(t.name).includes(q))
      )
    })
  }, [clusters, query])

  const selectedList = useMemo(() => Array.from(selected.values()), [selected])

  function selectTest(
    test: OrthoTest | { id: string; name: string; region: string | null; indications: string | null },
    fromClusterId: string | null = null,
  ) {
    setSelected(prev => {
      if (prev.has(test.id)) return prev
      const next = new Map(prev)
      const fullTest: OrthoTest = 'clusters' in test ? test : { ...test, clusters: [] }
      next.set(test.id, { test: fullTest, result: null, fromClusterId })
      return next
    })
  }

  function setResult(testId: string, result: TestResult) {
    setSelected(prev => {
      const entry = prev.get(testId)
      if (!entry) return prev
      const next = new Map(prev)
      next.set(testId, { ...entry, result })
      return next
    })
  }

  function removeSelected(testId: string) {
    setSelected(prev => { const next = new Map(prev); next.delete(testId); return next })
  }

  function toggleCluster(clusterId: string) {
    setExpandedClusters(prev => {
      const next = new Set(prev)
      if (next.has(clusterId)) next.delete(clusterId)
      else next.add(clusterId)
      return next
    })
  }

  function selectAllCluster(cluster: OrthoCluster) {
    setSelected(prev => {
      const next = new Map(prev)
      for (const t of cluster.tests) {
        if (!next.has(t.id)) next.set(t.id, { test: { ...t, clusters: [cluster.name] }, result: null, fromClusterId: cluster.id })
      }
      return next
    })
    setExpandedClusters(prev => new Set([...prev, cluster.id]))
  }

  function handleInject() {
    if (selected.size === 0) return

    const lines: string[] = []

    // Group by cluster (preserve insertion order)
    const clusterGroups = new Map<string, { clusterName: string; items: SelectedTest[] }>()
    const standaloneTests: SelectedTest[] = []

    for (const entry of selectedList) {
      if (entry.fromClusterId) {
        const cluster = clusters.find(c => c.id === entry.fromClusterId)
        const clusterName = cluster?.name ?? entry.fromClusterId
        if (!clusterGroups.has(entry.fromClusterId)) {
          clusterGroups.set(entry.fromClusterId, { clusterName, items: [] })
        }
        clusterGroups.get(entry.fromClusterId)!.items.push(entry)
      } else {
        standaloneTests.push(entry)
      }
    }

    // Cluster groups first
    for (const { clusterName, items } of clusterGroups.values()) {
      lines.push(`Cluster réalisé : ${clusterName}`)
      for (const { test, result } of items) {
        const cfg = result ? RESULT_CONFIG[result] : null
        const symbol = cfg ? `${cfg.symbol} ` : '• '
        const label = result ? ` — ${cfg!.label.toLowerCase()}` : ''
        lines.push(`  ${symbol}${test.name}${label}`)
      }
    }

    // Standalone tests
    if (standaloneTests.length > 0) {
      if (lines.length > 0) lines.push('')
      lines.push('Tests réalisés :')
      for (const { test, result } of standaloneTests) {
        const cfg = result ? RESULT_CONFIG[result] : null
        const symbol = cfg ? `${cfg.symbol} ` : '• '
        const label = result ? ` — ${cfg!.label.toLowerCase()}` : ''
        lines.push(`${symbol}${test.name}${label}`)
      }
    }

    onInject(lines.join('\n'))
    handleClose()
  }

  function handleClose() {
    onClose()
    setSelected(new Map())
    setQuery('')
    setRegionFilter(null)
    setExpandedClusters(new Set())
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="max-w-2xl h-[88vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 shrink-0">
          <DialogTitle>Tests orthopédiques</DialogTitle>
          <DialogDescription>
            Parcourez par test ou par cluster, indiquez les résultats, puis injectez.
          </DialogDescription>
        </DialogHeader>

        {/* Mode switcher + search */}
        <div className="px-6 pb-3 space-y-2 border-b shrink-0">
          <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
            <button
              onClick={() => { setMode('tests'); setQuery(''); setRegionFilter(null) }}
              className={`text-sm px-4 py-1.5 rounded-md font-medium transition-colors ${
                mode === 'tests' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Tests
            </button>
            <button
              onClick={() => { setMode('clusters'); setQuery('') }}
              className={`text-sm px-4 py-1.5 rounded-md font-medium transition-colors ${
                mode === 'clusters' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Clusters
              {clusters.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{clusters.length}</span>
              )}
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9"
              placeholder={mode === 'tests' ? 'Nom, indication, région…' : 'Nom du cluster ou région…'}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          {mode === 'tests' && regions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setRegionFilter(null)}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                  regionFilter === null ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                }`}
              >
                Toutes
              </button>
              {regions.map(r => (
                <button
                  key={r}
                  onClick={() => setRegionFilter(prev => prev === r ? null : r)}
                  className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                    regionFilter === r ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-1.5 min-h-0">
          {loading && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* TESTS MODE */}
          {!loading && mode === 'tests' && (
            <>
              {filteredTests.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Aucun test trouvé.</p>
              )}
              {filteredTests.map(test => {
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
                    onClick={() => { if (!sel) selectTest(test, null) }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight">{test.name}</p>
                        {test.indications && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{test.indications}</p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {test.region && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{test.region}</Badge>}
                          {test.clusters.slice(0, 2).map(c => (
                            <Badge key={c} variant="outline" className="text-[10px] px-1.5 py-0">{c}</Badge>
                          ))}
                        </div>
                      </div>
                      {sel && (
                        <ResultButtons testId={test.id} result={sel.result} onSet={setResult} onRemove={removeSelected} />
                      )}
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {/* CLUSTERS MODE */}
          {!loading && mode === 'clusters' && (
            <>
              {filteredClusters.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Aucun cluster trouvé.</p>
              )}
              {filteredClusters.map(cluster => {
                const expanded = expandedClusters.has(cluster.id)
                const clusterSelectedCount = cluster.tests.filter(t => selected.has(t.id)).length
                return (
                  <div key={cluster.id} className="rounded-lg border overflow-hidden">
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleCluster(cluster.id)}
                    >
                      {expanded
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-tight">{cluster.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {cluster.region && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{cluster.region}</Badge>}
                          <span className="text-xs text-muted-foreground">{cluster.tests.length} test{cluster.tests.length > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {clusterSelectedCount > 0 && (
                          <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            {clusterSelectedCount}/{cluster.tests.length}
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={e => { e.stopPropagation(); selectAllCluster(cluster) }}
                        >
                          Tout sélectionner
                        </Button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="border-t divide-y bg-muted/20">
                        {cluster.tests.map(test => {
                          const sel = selected.get(test.id)
                          const resultCfg = sel?.result ? RESULT_CONFIG[sel.result] : null
                          return (
                            <div
                              key={test.id}
                              className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                                sel
                                  ? resultCfg ? resultCfg.cardBg : 'bg-primary/5'
                                  : 'hover:bg-muted/50 cursor-pointer'
                              }`}
                              onClick={() => { if (!sel) selectTest(test, cluster.id) }}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium leading-tight">{test.name}</p>
                                {test.indications && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{test.indications}</p>
                                )}
                              </div>
                              {sel ? (
                                <ResultButtons testId={test.id} result={sel.result} onSet={setResult} onRemove={removeSelected} />
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Cliquer pour sélectionner</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* Selected summary */}
        {selectedList.length > 0 && (
          <div className="border-t bg-muted/30 px-6 py-3 shrink-0">
            <div className="flex flex-wrap gap-1.5">
              {selectedList.map(({ test, result }) => {
                const cfg = result ? RESULT_CONFIG[result] : null
                return (
                  <span
                    key={test.id}
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border font-medium ${
                      cfg ? cfg.badge : 'bg-muted border-border'
                    }`}
                  >
                    {cfg?.symbol} {test.name}
                    {result && <span className="opacity-70">· {cfg!.label.toLowerCase()}</span>}
                    <button onClick={() => removeSelected(test.id)} className="ml-0.5 opacity-50 hover:opacity-100">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )
              })}
            </div>
          </div>
        )}

        <DialogFooter className="px-6 py-4 border-t shrink-0 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {selectedList.length > 0
              ? `${selectedList.length} test${selectedList.length > 1 ? 's' : ''} sélectionné${selectedList.length > 1 ? 's' : ''}`
              : 'Aucun test sélectionné'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>Annuler</Button>
            <Button disabled={selected.size === 0} onClick={handleInject} className="gap-1.5">
              Injecter dans l&apos;examen
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
