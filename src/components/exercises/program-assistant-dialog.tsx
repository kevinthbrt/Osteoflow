'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Bot, Loader2, Wand2, Send, Check, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { describeItemChanges } from '@/lib/exercises/program-diff'
import type { ProgramView } from '@/lib/exercises/programs'

interface ProposedItem {
  exercise: {
    id: string; name: string; description: string | null; region: string; type: string; level: number
    illustration_url: string | null; nerve_target: string | null; progression_regression: string | null
  }
  sets: number | null; reps: string | null; hold_time: number | null; rest_time: number | null; frequency: string | null; notes: string | null
}

interface ProposedChange {
  action: 'update_phase' | 'add_phase'
  phase_index: number | null
  title: string
  starts_after_days: number
  clinical_notes: string
  patient_intro: string | null
  weekly_routine: string | null
  items: ProposedItem[]
}

interface Proposal {
  summary: string
  changes: ProposedChange[]
}

interface Props {
  open: boolean
  onClose: () => void
  program: ProgramView | null
  /** « Proposer la suite » lancé dès l'ouverture */
  autoNext?: boolean
  onApplied: () => void
}

const toDraft = (it: ProposedItem) => ({
  exercise: { ...it.exercise, description: it.exercise.description ?? '' },
  sets: it.sets,
  reps: it.reps ?? '',
  hold_time: it.hold_time,
  rest_time: it.rest_time,
  frequency: it.frequency ?? '',
  notes: it.notes ?? '',
  nerve_target: it.exercise.nerve_target ?? '',
  progression_regression: it.exercise.progression_regression ?? '',
})

const dose = (it: ProposedItem) =>
  [it.sets != null && it.reps ? `${it.sets} × ${it.reps}` : it.sets != null ? `${it.sets} séries` : it.reps,
    it.hold_time ? `${it.hold_time} s` : null, it.frequency].filter(Boolean).join(' · ')

/**
 * Assistant de programme : il lit les étapes, le suivi et l'historique, puis
 * propose des modifications que le praticien applique ou non. Une demande =
 * un appel ; seuls les deux derniers échanges sont renvoyés, pour garder un
 * coût prévisible.
 */
export function ProgramAssistantDialog({ open, onClose, program, autoNext, onApplied }: Props) {
  const { toast } = useToast()
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [lastRequest, setLastRequest] = useState('')
  const [history, setHistory] = useState<Array<{ request: string; summary: string }>>([])

  useEffect(() => {
    if (!open) { setProposal(null); setHistory([]); setInstruction(''); return }
    if (autoNext) ask('next')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function ask(mode: 'next' | 'instruction') {
    if (!program) return
    const request = mode === 'next' ? 'Proposer la suite' : instruction.trim()
    if (!request) return
    // La proposition précédente, non retenue, sert de contexte à la suivante.
    const nextHistory = proposal ? [...history, { request: lastRequest, summary: proposal.summary }].slice(-2) : history
    setLoading(true)
    setProposal(null)
    try {
      const res = await fetch('/api/ai/adjust-exercise-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_id: program.id, mode, instruction: mode === 'instruction' ? request : undefined, history: nextHistory }),
      })
      const data = await res.json()
      if (!res.ok) { toast({ title: data.error || 'L’assistant n’a pas pu répondre', variant: 'destructive' }); return }
      setHistory(nextHistory)
      setLastRequest(request)
      setProposal(data)
      setInstruction('')
    } catch {
      toast({ title: 'Erreur réseau', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function apply() {
    if (!program || !proposal) return
    setApplying(true)
    try {
      const vigilance = program.phases[program.current_phase]?.vigilance_points ?? null
      for (const c of proposal.changes) {
        const items = c.items.map(toDraft)
        if (c.action === 'update_phase' && c.phase_index != null) {
          const phase = program.phases[c.phase_index]
          const res = await fetch(`/api/exercise-prescriptions/${phase.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: c.title, notes: phase.notes, items, change_source: 'ia',
              ...(c.phase_index > 0 ? { starts_after_days: c.starts_after_days } : {}),
              patient_intro: c.patient_intro, weekly_routine: c.weekly_routine, clinical_notes: c.clinical_notes,
            }),
          })
          if (!res.ok) throw new Error()
        } else {
          const res = await fetch('/api/exercise-prescriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              patient_id: program.patient_id, program_id: program.id, starts_after_days: c.starts_after_days,
              title: c.title, items, change_source: 'ia',
              patient_intro: c.patient_intro, weekly_routine: c.weekly_routine, clinical_notes: c.clinical_notes, vigilance_points: vigilance,
            }),
          })
          if (!res.ok) throw new Error()
        }
      }
      toast({ title: 'Modifications appliquées', description: 'Pensez à renvoyer le lien au patient.' })
      onApplied()
      onClose()
    } catch {
      toast({ title: 'Une modification n’a pas pu être appliquée', variant: 'destructive' })
      onApplied()
    } finally {
      setApplying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && !applying && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" />Assistant de programme</DialogTitle>
          {program && <p className="text-sm text-muted-foreground">{program.title} · étape {program.current_phase + 1} sur {program.phases.length}</p>}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            L&apos;assistant lit les étapes, les bilans du patient et l&apos;historique de ce programme, puis propose des modifications. Rien ne change sans votre validation.
          </p>

          {loading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground rounded-lg border p-4">
              <Loader2 className="h-4 w-4 animate-spin" />L&apos;assistant analyse le programme et le suivi…
            </p>
          )}

          {proposal && !loading && program && (
            <div className="space-y-3">
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-primary mb-1">{lastRequest}</p>
                <p className="text-sm leading-relaxed">{proposal.summary}</p>
              </div>
              {proposal.changes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune modification proposée.</p>
              ) : (
                proposal.changes.map((c, k) => <ChangeCard key={k} change={c} program={program} />)
              )}
            </div>
          )}

          <div className="space-y-2">
            <Textarea
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              rows={2}
              className="resize-none text-sm"
              placeholder={proposal ? 'Ajuster la proposition : « garde le Nordic mais à 2 séries », « décale l’étape d’une semaine »…' : 'Votre consigne : « elle a encore 5 au réveil, allège la charge », « remplace le Nordic, douleur derrière le genou »…'}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ask('instruction') }}
              disabled={loading || applying}
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => ask('instruction')} disabled={!instruction.trim() || loading || applying}>
                <Send className="mr-1.5 h-4 w-4" />Envoyer la consigne
              </Button>
              <Button size="sm" variant="outline" onClick={() => ask('next')} disabled={loading || applying}>
                <Wand2 className="mr-1.5 h-4 w-4" />Proposer la suite
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t px-6 py-3">
          <Button variant="ghost" size="sm" onClick={() => { setProposal(null); setHistory([]) }} disabled={!proposal || loading || applying}>
            <RotateCcw className="mr-1.5 h-4 w-4" />Repartir de zéro
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={applying}>Fermer</Button>
            <Button onClick={apply} disabled={!proposal?.changes.length || loading || applying}>
              {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Appliquer {proposal?.changes.length ? `(${proposal.changes.length})` : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ChangeCard({ change: c, program }: { change: ProposedChange; program: ProgramView }) {
  const [showWhy, setShowWhy] = useState(false)
  const before = c.action === 'update_phase' && c.phase_index != null ? program.phases[c.phase_index] : null
  const diff = before ? describeItemChanges(before.items ?? [], c.items.map(it => ({ ...it, reps: it.reps ?? '', frequency: it.frequency ?? '' }))) : null
  const week = Math.floor(c.starts_after_days / 7) + 1
  const moved = before && c.phase_index! > 0 && (before.starts_after_days ?? 0) !== c.starts_after_days
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">
          {before ? `Modifier l’étape ${c.phase_index! + 1}` : `Nouvelle étape dès la semaine ${week}`} : {c.title}
        </p>
        {moved && <span className="text-xs text-amber-700 dark:text-amber-300">début déplacé à la semaine {week}</span>}
      </div>
      {before && <p className="text-xs text-muted-foreground">{diff ? diff.charAt(0).toUpperCase() + diff.slice(1) : 'Exercices et dosage inchangés.'}</p>}
      <ul className="flex flex-wrap gap-1.5">
        {c.items.map(it => (
          <li key={it.exercise.id} className="rounded bg-muted px-2 py-0.5 text-xs">
            {it.exercise.name}<span className="text-muted-foreground">{dose(it) ? ` · ${dose(it)}` : ''}</span>
          </li>
        ))}
      </ul>
      {c.weekly_routine && <p className="text-xs text-muted-foreground">Routine : {c.weekly_routine}</p>}
      <button type="button" className="text-xs text-primary flex items-center gap-1 hover:underline" onClick={() => setShowWhy(v => !v)}>
        {showWhy ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}Justification
      </button>
      {showWhy && <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">{c.clinical_notes}</p>}
    </div>
  )
}
