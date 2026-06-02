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
import { Loader2, Search, CheckCircle2, XCircle, Circle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface OrthoTest {
  id: string
  name: string
  category: string | null
  indications: string | null
  region: string | null
  clusters: string[]
}

interface SelectedTest {
  test: OrthoTest
  result: 'positive' | 'negative' | null
}

interface OrthoTestsPickerDialogProps {
  open: boolean
  onClose: () => void
  onInject: (text: string) => void
}

export function OrthoTestsPickerDialog({ open, onClose, onInject }: OrthoTestsPickerDialogProps) {
  const { toast } = useToast()
  const [tests, setTests] = useState<OrthoTest[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [regionFilter, setRegionFilter] = useState<string | null>(null)
  const [selected, setSelected] = useState<Map<string, SelectedTest>>(new Map())

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

  function cycleResult(testId: string) {
    setSelected(prev => {
      const entry = prev.get(testId)
      if (!entry) return prev
      const next = new Map(prev)
      const cycle: Array<SelectedTest['result']> = [null, 'positive', 'negative']
      const idx = cycle.indexOf(entry.result)
      next.set(testId, { ...entry, result: cycle[(idx + 1) % cycle.length] })
      return next
    })
  }

  function handleInject() {
    if (selected.size === 0) return
    const lines: string[] = []
    for (const { test, result } of selected.values()) {
      const resultLabel =
        result === 'positive' ? ' ✚ positif' : result === 'negative' ? ' − négatif' : ''
      lines.push(`- ${test.name}${resultLabel}`)
    }
    onInject(lines.join('\n'))
    onClose()
    setSelected(new Map())
    setQuery('')
    setRegionFilter(null)
  }

  function handleClose() {
    onClose()
    setSelected(new Map())
    setQuery('')
    setRegionFilter(null)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Tests orthopédiques</DialogTitle>
          <DialogDescription>
            Sélectionnez les tests effectués et indiquez s&apos;ils sont positifs ou négatifs.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-3 space-y-2 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Rechercher par nom, indication, région…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          {regions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setRegionFilter(null)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
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
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
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

        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-1.5">
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
            return (
              <div
                key={test.id}
                className={`rounded-lg border p-3 transition-colors cursor-pointer ${
                  sel ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30' : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => toggleSelect(test)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{test.name}</p>
                    {test.indications && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{test.indications}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {test.region && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{test.region}</Badge>
                      )}
                      {test.clusters.slice(0, 3).map(c => (
                        <Badge key={c} variant="outline" className="text-[10px] px-1.5 py-0">{c}</Badge>
                      ))}
                    </div>
                  </div>
                  {sel && (
                    <button
                      onClick={e => { e.stopPropagation(); cycleResult(test.id) }}
                      className="shrink-0 mt-0.5"
                      title="Cliquer pour changer le résultat"
                    >
                      {sel.result === 'positive' ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : sel.result === 'negative' ? (
                        <XCircle className="h-5 w-5 text-rose-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-emerald-400" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <DialogFooter className="px-6 py-4 border-t flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {selected.size > 0 ? `${selected.size} test${selected.size > 1 ? 's' : ''} sélectionné${selected.size > 1 ? 's' : ''}` : 'Aucun test sélectionné'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>Annuler</Button>
            <Button
              disabled={selected.size === 0}
              onClick={handleInject}
              className="gap-1.5"
            >
              Injecter dans l&apos;examen
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
