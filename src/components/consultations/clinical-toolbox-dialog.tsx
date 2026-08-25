'use client'

import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Check, ClipboardList, RotateCcw, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import {
  CATEGORY_LABELS,
  CLINICAL_QUESTIONNAIRES,
  QUESTIONNAIRE_CATEGORIES,
  TARGET_LABELS,
  type ClinicalQuestionnaire,
  type QuestionnaireAnswers,
  type QuestionnaireCategory,
  type QuestionnaireLevel,
  type QuestionnaireTarget,
  answered,
  formatQuestionnaireResult,
  isScorable,
  itemIds,
  requiredAnswers,
  searchQuestionnaires,
} from '@/lib/consultations/questionnaires'

interface ClinicalToolboxDialogProps {
  open: boolean
  onClose: () => void
  /** Insère le compte rendu dans le champ demandé du formulaire de consultation. */
  onInject: (text: string, target: QuestionnaireTarget) => void
}

/** Teintes du bandeau de résultat, du plus rassurant au plus alarmant. */
const LEVEL_STYLES: Record<QuestionnaireLevel, string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-200',
  low: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200',
  moderate: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200',
  high: 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-200',
  critical: 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200',
}

const TARGETS: QuestionnaireTarget[] = ['anamnesis', 'examination', 'advice']

export function ClinicalToolboxDialog({ open, onClose, onInject }: ClinicalToolboxDialogProps) {
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<QuestionnaireCategory | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [answersById, setAnswersById] = useState<Record<string, QuestionnaireAnswers>>({})
  const [insertedIds, setInsertedIds] = useState<string[]>([])
  const [detailed, setDetailed] = useState(false)
  const [target, setTarget] = useState<QuestionnaireTarget | null>(null)

  const active = activeId ? CLINICAL_QUESTIONNAIRES.find((q) => q.id === activeId) ?? null : null
  const answers = activeId ? answersById[activeId] ?? {} : {}

  const results = useMemo(() => searchQuestionnaires(query, category), [query, category])

  const grouped = useMemo(() => {
    return QUESTIONNAIRE_CATEGORIES.map((key) => ({
      category: key,
      questionnaires: results.filter((questionnaire) => questionnaire.category === key),
    })).filter((group) => group.questionnaires.length > 0)
  }, [results])

  function handleClose() {
    onClose()
    // Les réponses sont conservées tant que la consultation est ouverte : un
    // praticien qui referme la caisse à outils pour vérifier un point de
    // l'anamnèse retrouve son questionnaire là où il l'avait laissé.
    setActiveId(null)
    setQuery('')
    setCategory(null)
  }

  function openQuestionnaire(questionnaire: ClinicalQuestionnaire) {
    setActiveId(questionnaire.id)
    setTarget(null)
  }

  function setAnswer(itemId: string, value: number) {
    if (!activeId) return
    setAnswersById((previous) => {
      const current = previous[activeId] ?? {}
      // Recliquer sur l'option déjà retenue efface la réponse : c'est la seule
      // façon de laisser vierge un item coché par erreur.
      const next = current[itemId] === value ? undefined : value
      return { ...previous, [activeId]: { ...current, [itemId]: next } }
    })
  }

  function resetActive() {
    if (!activeId) return
    setAnswersById((previous) => ({ ...previous, [activeId]: {} }))
  }

  function insert() {
    if (!active) return
    const text = formatQuestionnaireResult(active, answers, { detailed })
    if (!text) return
    const destination = target ?? active.target
    onInject(text, destination)
    setInsertedIds((previous) => (previous.includes(active.id) ? previous : [...previous, active.id]))
    toast({
      title: `${active.abbreviation} inséré`,
      description: `Résultat ajouté au champ « ${TARGET_LABELS[destination]} ».`,
    })
    setActiveId(null)
  }

  const scorable = active ? isScorable(active, answers) : false
  const score = active && scorable ? active.score(answers) : null
  const answeredCount = active ? answered(answers, itemIds(active)) : 0

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) handleClose() }}>
      <DialogContent className="max-w-3xl h-[88vh] flex flex-col gap-0 p-0 overflow-hidden">
        {active ? (
          <>
            <DialogHeader className="px-6 pt-5 pb-3 shrink-0 border-b">
              <div className="flex items-start gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 -ml-2 shrink-0"
                  onClick={() => setActiveId(null)}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Outils
                </Button>
                <div className="min-w-0">
                  <DialogTitle className="text-base">
                    {active.abbreviation} — {active.name}
                  </DialogTitle>
                  <DialogDescription className="mt-1">{active.source}</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {active.items.map((item, index) => (
                <div key={item.id} className="space-y-2">
                  {item.section && (
                    <p
                      className={cn(
                        'text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                        index > 0 && 'pt-3',
                      )}
                    >
                      {item.section}
                    </p>
                  )}
                  <div className="rounded-xl border bg-card p-3 space-y-2">
                    <p className="text-sm font-medium leading-snug">
                      <span className="text-muted-foreground mr-1.5">{index + 1}.</span>
                      {item.text}
                    </p>
                    {item.help && <p className="text-xs text-muted-foreground">{item.help}</p>}
                    <div className="flex flex-wrap gap-1.5">
                      {item.options.map((option) => {
                        const selected = answers[item.id] === option.value
                        return (
                          <button
                            key={`${item.id}-${option.value}-${option.label}`}
                            type="button"
                            onClick={() => setAnswer(item.id, option.value)}
                            className={cn(
                              'text-xs px-2.5 py-1.5 rounded-lg border transition-colors text-left',
                              selected
                                ? 'border-primary bg-primary text-primary-foreground font-semibold'
                                : 'border-border bg-background hover:bg-muted',
                            )}
                          >
                            {option.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t px-6 py-3 shrink-0 space-y-3 bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(answeredCount / active.items.length) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {answeredCount}/{active.items.length} réponses
                </span>
                <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={resetActive}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Réinitialiser
                </Button>
              </div>

              {score ? (
                <div className={cn('rounded-xl border px-3 py-2', LEVEL_STYLES[score.level])}>
                  <p className="text-sm font-semibold">{score.headline}</p>
                  <p className="text-xs mt-0.5 leading-snug">{score.interpretation}</p>
                  {score.details && score.details.length > 0 && (
                    <p className="text-xs mt-1 opacity-80">
                      {score.details.map((detail) => `${detail.label} : ${detail.value}`).join(' · ')}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Encore {requiredAnswers(active) - answeredCount} réponse
                  {requiredAnswers(active) - answeredCount > 1 ? 's' : ''} avant de pouvoir coter.
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Insérer dans</span>
                  {TARGETS.map((option) => {
                    const selected = (target ?? active.target) === option
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setTarget(option)}
                        className={cn(
                          'text-xs px-2 py-1 rounded-md border transition-colors',
                          selected
                            ? 'border-primary bg-primary/10 text-primary font-semibold'
                            : 'border-border hover:bg-muted',
                        )}
                      >
                        {TARGET_LABELS[option]}
                      </button>
                    )
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailed((value) => !value)}
                    className={cn(
                      'text-xs px-2 py-1 rounded-md border transition-colors',
                      detailed
                        ? 'border-primary bg-primary/10 text-primary font-semibold'
                        : 'border-border hover:bg-muted',
                    )}
                  >
                    Détail des réponses
                  </button>
                  <Button type="button" size="sm" className="gap-1.5" disabled={!scorable} onClick={insert}>
                    <Check className="h-4 w-4" />
                    Insérer
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader className="px-6 pt-5 pb-3 shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Caisse à outils
              </DialogTitle>
              <DialogDescription>
                {CLINICAL_QUESTIONNAIRES.length} questionnaires et règles de décision validés. Remplissez
                pendant la consultation : le score et son interprétation s&apos;insèrent dans le compte rendu.
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-3 space-y-2 border-b shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher un outil (DN4, lombalgie, épaule, sommeil…)"
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setCategory(null)}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-full border transition-colors',
                    category === null
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border hover:bg-muted',
                  )}
                >
                  Tout
                </button>
                {QUESTIONNAIRE_CATEGORIES.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(category === key ? null : key)}
                    className={cn(
                      'text-xs px-2.5 py-1 rounded-full border transition-colors',
                      category === key
                        ? 'border-primary bg-primary/10 text-primary font-semibold'
                        : 'border-border hover:bg-muted',
                    )}
                  >
                    {CATEGORY_LABELS[key]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {grouped.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Aucun outil ne correspond à cette recherche.
                </p>
              )}
              {grouped.map((group) => (
                <div key={group.category} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {CATEGORY_LABELS[group.category]}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.questionnaires.map((questionnaire) => {
                      const started = answered(
                        answersById[questionnaire.id] ?? {},
                        itemIds(questionnaire),
                      )
                      return (
                        <button
                          key={questionnaire.id}
                          type="button"
                          onClick={() => openQuestionnaire(questionnaire)}
                          className="text-left rounded-xl border bg-card p-3 hover:border-primary hover:bg-primary/5 transition-colors"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold">{questionnaire.abbreviation}</span>
                            {insertedIds.includes(questionnaire.id) && (
                              <Badge variant="success" className="text-[10px]">Inséré</Badge>
                            )}
                            {!insertedIds.includes(questionnaire.id) && started > 0 && (
                              <Badge variant="info" className="text-[10px]">
                                {started}/{questionnaire.items.length}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 leading-snug">
                            {questionnaire.purpose}
                          </p>
                          <p className="text-[11px] text-muted-foreground/80 mt-1.5">
                            {questionnaire.items.length} item{questionnaire.items.length > 1 ? 's' : ''}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
