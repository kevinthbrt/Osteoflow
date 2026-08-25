'use client'

import { useMemo } from 'react'
import { AlertTriangle, ArrowRight, Check, ClipboardList, Loader2, Minus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  activeHypotheses,
  knowledgeFor,
  reason as runReasoning,
  REGION_LABELS,
  type Region,
  type ScoredHypothesis,
  type SignalId,
  type SuggestedAction,
} from '@/lib/reasoning'

export type SignalSource = 'dictée' | 'praticien' | 'test' | 'dossier'

export interface SignalTrace {
  source: SignalSource
  /** Les mots du patient qui ont produit le signal — la preuve, pas la reformulation. */
  verbatim?: string
}

interface CopilotProps {
  region: Region
  signals: Partial<Record<SignalId, boolean>>
  traces: Partial<Record<SignalId, SignalTrace>>
  busy: boolean
  /** Actions déjà réalisées pendant cette consultation. */
  done: string[]
  /** L'extraction automatique n'est pas configurée sur ce poste. */
  aiUnavailable?: boolean
  /** Rien n'a encore été dit : ce n'est pas le moment de poser des questions. */
  started: boolean
  onAnswer: (signal: SignalId, value: boolean) => void
  onOpenQuestionnaire: (questionnaireId: string, actionId: string) => void
  onRegionChange: (region: Region) => void
}

const REGIONS: Region[] = ['lombaire', 'cervical']

/** Une hypothèse repose-t-elle sur quelque chose, ou n'est-elle qu'une case du catalogue ? */
function hasArguments(hypothesis: ScoredHypothesis): boolean {
  return hypothesis.argumentsFor.length > 0 || hypothesis.argumentsAgainst.length > 0
}

function HypothesisRow({
  hypothesis,
  rank,
  traces,
}: {
  hypothesis: ScoredHypothesis
  rank: number
  traces: Partial<Record<SignalId, SignalTrace>>
}) {
  const verbatims = useMemo(
    () =>
      Object.values(traces)
        .filter((trace): trace is SignalTrace => !!trace?.verbatim)
        .slice(0, 3),
    [traces],
  )

  return (
    <div className="group py-2.5">
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            'text-[11px] tabular-nums w-3 shrink-0',
            rank === 1 ? 'text-primary font-semibold' : 'text-muted-foreground/50',
          )}
        >
          {rank}
        </span>
        <span
          className={cn(
            'text-[13.5px] leading-snug flex-1',
            rank === 1 ? 'font-semibold' : 'font-medium',
          )}
        >
          {hypothesis.label}
        </span>
      </div>

      <div className="ml-5 mt-1 space-y-0.5">
        {hypothesis.argumentsFor.slice(0, 2).map((argument) => (
          <p key={argument} className="text-[11.5px] leading-snug text-muted-foreground">
            <span className="text-emerald-600 dark:text-emerald-400 mr-1">+</span>
            {argument}
          </p>
        ))}
        {hypothesis.argumentsAgainst.slice(0, 1).map((argument) => (
          <p key={argument} className="text-[11.5px] leading-snug text-muted-foreground">
            <span className="text-rose-500 mr-1">−</span>
            {argument}
          </p>
        ))}
        {hypothesis.unexplored.slice(0, 2).map((argument) => (
          <p
            key={argument}
            className="text-[11.5px] leading-snug text-muted-foreground/55 hidden group-hover:block"
          >
            <span className="mr-1">?</span>
            {argument}
          </p>
        ))}
        {verbatims.length > 0 && (
          <p className="text-[11px] italic leading-snug text-muted-foreground/50 hidden group-hover:block pt-0.5">
            « {verbatims.map((trace) => trace.verbatim).join(' … ')} »
          </p>
        )}
      </div>
    </div>
  )
}

function ActionRow({
  suggestion,
  onAnswer,
  onOpenQuestionnaire,
}: {
  suggestion: SuggestedAction
  onAnswer: (signal: SignalId, value: boolean) => void
  onOpenQuestionnaire: (questionnaireId: string, actionId: string) => void
}) {
  const { action } = suggestion
  // Un questionnaire se remplit, il ne se répond pas par oui ou par non.
  const target = action.questionnaireId ? undefined : action.resolves?.[0]

  return (
    <div className="py-2">
      <p className="text-[12.5px] leading-snug">{action.label}</p>
      {action.performance && (
        <p className="text-[11px] text-muted-foreground/60 mt-0.5">{action.performance}</p>
      )}

      <div className="flex flex-wrap items-center gap-1 mt-1.5">
        {action.options ? (
          action.options.map((option) => (
            <button
              key={option.signal}
              type="button"
              onClick={() => onAnswer(option.signal, true)}
              className="text-[11px] font-medium px-2 py-1 rounded-md border border-border/70 hover:border-primary hover:bg-primary/[0.07] hover:text-primary transition-colors"
            >
              {option.label}
            </button>
          ))
        ) : target ? (
          <>
            <button
              type="button"
              onClick={() => onAnswer(target, true)}
              className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-border/70 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 transition-colors"
            >
              <Check className="h-3 w-3" />
              {action.kind === 'test' ? 'Positif' : 'Oui'}
            </button>
            <button
              type="button"
              onClick={() => onAnswer(target, false)}
              className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-border/70 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 transition-colors"
            >
              <X className="h-3 w-3" />
              {action.kind === 'test' ? 'Négatif' : 'Non'}
            </button>
          </>
        ) : null}

        {action.questionnaireId && (
          <button
            type="button"
            onClick={() => onOpenQuestionnaire(action.questionnaireId!, action.id)}
            className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-border/70 hover:border-primary hover:text-primary transition-colors"
          >
            <ClipboardList className="h-3 w-3" />
            Ouvrir
          </button>
        )}

        {!target && !action.options && !action.questionnaireId && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
            <ArrowRight className="h-3 w-3" />
            {action.urgency === 'urgent' ? 'à faire maintenant' : 'à prévoir'}
          </span>
        )}
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50 mb-1">
      {children}
    </p>
  )
}

export function Copilot({
  region,
  signals,
  traces,
  busy,
  started,
  done,
  aiUnavailable,
  onAnswer,
  onOpenQuestionnaire,
  onRegionChange,
}: CopilotProps) {
  const knowledge = knowledgeFor(region)
  const result = useMemo(
    () =>
      runReasoning({
        signals,
        hypotheses: knowledge.hypotheses,
        actions: knowledge.actions,
        done,
        actionLimit: 3,
      }),
    [signals, knowledge, done],
  )

  // On n'affiche que ce qui repose sur un argument. Une hypothèse sans le
  // moindre élément n'est pas une piste, c'est une ligne de catalogue : la
  // montrer donnerait à croire qu'elle est envisagée.
  const inPlay = activeHypotheses(result)
  const argued = inPlay.filter(hasArguments).slice(0, 3)
  const shortlist = argued.length > 0 ? argued : []
  const toExplore = argued.length === 0 ? inPlay.slice(0, 2) : []
  // Sans extraction automatique, le copilote reste utilisable : il faut juste
  // le dire, sinon la dictée semble ignorée.
  const aiRelevé = aiUnavailable ? ' · relevé manuel' : ''
  const relevé = Object.values(signals).filter((value) => value !== undefined).length

  return (
    <aside className="w-[340px] shrink-0 border-l border-border/50 bg-muted/[0.18] flex flex-col">
      <div className="px-5 h-14 flex items-center justify-between border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-semibold tracking-tight">Copilote</span>
          {busy && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/60" />}
        </div>
        <div className="flex gap-0.5 p-0.5 rounded-lg bg-foreground/[0.04]">
          {REGIONS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              onClick={() => onRegionChange(candidate)}
              className={cn(
                'text-[10.5px] font-medium px-2 py-1 rounded-md transition-colors',
                region === candidate
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {candidate === 'lombaire' ? 'Lombaire' : 'Cervical'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {result.redFlags.length > 0 && (
          <div className="rounded-xl border border-rose-300/70 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/30 p-3">
            {result.redFlags.map((flag) => (
              <div key={flag.id} className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <p className="text-[12.5px] font-semibold text-rose-800 dark:text-rose-200">
                    {flag.label}
                  </p>
                </div>
                {flag.argumentsFor.slice(0, 2).map((argument) => (
                  <p key={argument} className="text-[11.5px] leading-snug text-rose-700/90 dark:text-rose-300/90">
                    {argument}
                  </p>
                ))}
                {flag.note && (
                  <p className="text-[11.5px] leading-snug font-medium text-rose-800 dark:text-rose-200 pt-0.5">
                    {flag.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {shortlist.length > 0 ? (
          <div>
            <SectionTitle>Différentiel</SectionTitle>
            <div className="divide-y divide-border/40">
              {shortlist.map((hypothesis, index) => (
                <HypothesisRow
                  key={hypothesis.id}
                  hypothesis={hypothesis}
                  rank={index + 1}
                  traces={traces}
                />
              ))}
            </div>
          </div>
        ) : toExplore.length > 0 ? (
          <div>
            <SectionTitle>À explorer</SectionTitle>
            <div className="divide-y divide-border/40">
              {toExplore.map((hypothesis) => (
                <div key={hypothesis.id} className="py-2">
                  <p className="text-[13px] leading-snug text-muted-foreground">{hypothesis.label}</p>
                  {hypothesis.unexplored.slice(0, 2).map((argument) => (
                    <p key={argument} className="text-[11.5px] leading-snug text-muted-foreground/55 mt-0.5">
                      ? {argument}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-[12.5px] text-muted-foreground/70 leading-relaxed whitespace-pre-line">
              {!started
                ? 'Dictez l’anamnèse.\nLe copilote suit.'
                : 'Pas encore d’argument suffisant.\nRépondez à une question ci-dessous.'}
            </p>
          </div>
        )}

        {started && result.nextActions.length > 0 && (
          <div>
            <SectionTitle>Prochaine étape</SectionTitle>
            <div className="divide-y divide-border/40">
              {result.nextActions.map((suggestion) => (
                <ActionRow
                  key={suggestion.action.id}
                  suggestion={suggestion}
                  onAnswer={onAnswer}
                  onOpenQuestionnaire={onOpenQuestionnaire}
                />
              ))}
            </div>
          </div>
        )}

        {result.excluded.length > 0 && (
          <details className="group">
            <summary className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/40 cursor-pointer list-none hover:text-muted-foreground/70 transition-colors">
              {result.excluded.length} écartée{result.excluded.length > 1 ? 's' : ''}
            </summary>
            <div className="pt-1.5 space-y-0.5">
              {result.excluded.map((hypothesis) => (
                <p
                  key={hypothesis.id}
                  className="text-[11.5px] text-muted-foreground/50 flex items-center gap-1.5"
                >
                  <Minus className="h-2.5 w-2.5 shrink-0" />
                  {hypothesis.label}
                </p>
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="px-5 py-2.5 border-t border-border/40 shrink-0">
        <p className="text-[10.5px] text-muted-foreground/50 leading-snug">
          {relevé} signe{relevé > 1 ? 's' : ''} relevé{relevé > 1 ? 's' : ''} · {REGION_LABELS[region]}
          {aiRelevé}
        </p>
      </div>
    </aside>
  )
}
