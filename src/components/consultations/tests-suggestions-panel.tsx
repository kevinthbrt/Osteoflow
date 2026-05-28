'use client'

import { useState } from 'react'
import {
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  Activity,
  MapPin,
  Layers,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface TestSuggestion {
  test_id: string
  test_name: string
  region: string
  cluster_names: string[]
  priority: 'high' | 'medium' | 'low'
  rationale: string
}

interface SuggestTestsResult {
  detected_regions: string[]
  clinical_summary: string
  suggested_tests: TestSuggestion[]
}

interface TestsSuggestionsPanelProps {
  anamnesis: string
  reason?: string
}

const PRIORITY_CONFIG = {
  high: { label: 'Prioritaire', color: 'text-red-700 bg-red-50 border-red-200' },
  medium: { label: 'À considérer', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  low: { label: 'Différentiel', color: 'text-blue-700 bg-blue-50 border-blue-200' },
} as const

export function TestsSuggestionsPanel({ anamnesis, reason }: TestsSuggestionsPanelProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SuggestTestsResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  const handleAnalyze = async () => {
    if (!anamnesis?.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/ai/suggest-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anamnesis, reason }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur lors de l\'analyse')
      }

      const data: SuggestTestsResult = await res.json()
      setResult(data)
      setExpanded(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  if (!anamnesis?.trim()) return null

  return (
    <Card className="border-violet-200 bg-violet-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-violet-500 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            Tests orthopédiques suggérés
          </CardTitle>
          <div className="flex items-center gap-1">
            {result && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(!expanded)}
                  className="h-7 w-7 p-0"
                >
                  {expanded
                    ? <ChevronUp className="h-4 w-4" />
                    : <ChevronDown className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setResult(null)}
                  className="h-7 w-7 p-0 text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {!result && !loading && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              L\'IA analyse l\'anamnèse et suggère les tests les plus pertinents
              depuis la base OsteoUpgrade (116 tests).
            </p>
            <Button
              onClick={handleAnalyze}
              variant="outline"
              size="sm"
              className="border-violet-300 text-violet-700 hover:bg-violet-50 hover:border-violet-400"
            >
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              Analyser les tests pertinents
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-3 py-2">
            <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
            <span className="text-sm text-muted-foreground">Analyse de l\'anamnèse en cours…</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && expanded && (
          <div className="space-y-4">
            {result.clinical_summary && (
              <p className="text-sm text-muted-foreground italic border-l-2 border-violet-300 pl-3">
                {result.clinical_summary}
              </p>
            )}

            {result.detected_regions?.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Régions :
                </span>
                {result.detected_regions.map((r) => (
                  <Badge key={r} variant="outline" className="text-xs">
                    {r}
                  </Badge>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {(['high', 'medium', 'low'] as const).map((priority) => {
                const tests = result.suggested_tests.filter((t) => t.priority === priority)
                if (tests.length === 0) return null
                const config = PRIORITY_CONFIG[priority]
                return (
                  <div key={priority} className="space-y-1.5">
                    <span
                      className={cn(
                        'text-xs font-semibold px-2 py-0.5 rounded border inline-block',
                        config.color
                      )}
                    >
                      {config.label}
                    </span>
                    {tests.map((test) => (
                      <div
                        key={test.test_id}
                        className="bg-white rounded-lg border border-slate-200 p-3 space-y-1 shadow-sm"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{test.test_name}</span>
                          <Badge variant="secondary" className="text-xs">
                            <Activity className="h-2.5 w-2.5 mr-1" />
                            {test.region}
                          </Badge>
                          {test.cluster_names?.map((c) => (
                            <Badge
                              key={c}
                              variant="outline"
                              className="text-xs text-violet-700 border-violet-200"
                            >
                              <Layers className="h-2.5 w-2.5 mr-1" />
                              {c}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">{test.rationale}</p>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>

            <Button
              onClick={handleAnalyze}
              variant="ghost"
              size="sm"
              className="text-violet-600 hover:text-violet-700 hover:bg-violet-50 text-xs h-7"
            >
              <Sparkles className="mr-1.5 h-3 w-3" />
              Relancer l\'analyse
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
