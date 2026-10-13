'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  Dumbbell, Plus, Sparkles, Smartphone, Mail, Download, Activity, Pencil, Trash2,
  FlaskConical, Pause, Play, AlertTriangle, History, Loader2, CalendarClock, Bot,
} from 'lucide-react'
import { ExercisePrescriptionDialog } from '@/components/exercises/exercise-prescription-dialog'
import { AiExerciseGenerationDialog } from '@/components/exercises/ai-exercise-generation-dialog'
import { AdherenceReportDialog, WeeksTable } from '@/components/exercises/adherence-report-dialog'
import { copyPatientLink } from '@/components/exercises/copy-patient-link'
import { ProgramAssistantDialog } from '@/components/exercises/program-assistant-dialog'
import type { ProgramView } from '@/lib/exercises/programs'
import type { UsageLevel } from '@/lib/exercises/usage'
import type { WeekSummary } from '@/lib/exercises/patient-link-codec'
import type { ExercisePrescription } from '@/types/exercise'

interface Props {
  patientId: string
  patientName: string
}

const frDay = (iso: string, withYear = false) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00` : iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`)
    .toLocaleDateString('fr-FR', withYear ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short' })
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
const weekOf = (startDate: string) =>
  Math.floor((Date.now() - Date.parse(`${startDate}T12:00:00`)) / (7 * 864e5)) + 1

const USAGE_STYLE: Record<UsageLevel, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  low: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  inactive: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  waiting: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  not_sent: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  ended: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
}

export function UsagePill({ usage }: { usage: ProgramView['usage'] }) {
  return (
    <span title={usage.detail ?? undefined} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${USAGE_STYLE[usage.level]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {usage.label}
    </span>
  )
}

/**
 * Onglet « Exercices » du dossier : les programmes du patient, leurs étapes
 * planifiées, le suivi rapporté par l'appli patient et l'historique des
 * modifications.
 */
export function PatientExercisesTab({ patientId, patientName }: Props) {
  const { toast } = useToast()
  const [programs, setPrograms] = useState<ProgramView[]>([])
  const [loading, setLoading] = useState(true)
  const [create, setCreate] = useState<null | { mode: 'manual' | 'ai'; programId?: string; startsAfterDays?: number }>(null)
  const [editing, setEditing] = useState<ExercisePrescription | null>(null)
  const [reportFor, setReportFor] = useState<ExercisePrescription | null>(null)
  const [ebp, setEbp] = useState<ExercisePrescription | null>(null)
  const [assistant, setAssistant] = useState<{ program: ProgramView; autoNext: boolean } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/exercise-programs?patient_id=${patientId}`)
      const data = await res.json()
      setPrograms(data.programs || [])
    } catch {
      toast({ title: 'Impossible de charger les programmes', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [patientId, toast])

  useEffect(() => { load() }, [load])

  const patch = async (programId: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/exercise-programs/${programId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (!res.ok) { toast({ title: 'Modification impossible', variant: 'destructive' }); return }
    await load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Dumbbell className="h-5 w-5" />Programmes d&apos;exercices</h2>
          <p className="text-sm text-muted-foreground">Étapes planifiées, suivi rapporté par l&apos;appli du patient et historique des modifications.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCreate({ mode: 'ai' })}><Sparkles className="mr-2 h-4 w-4 text-primary" />Programme avec l&apos;IA</Button>
          <Button onClick={() => setCreate({ mode: 'manual' })}><Plus className="mr-2 h-4 w-4" />Nouveau programme</Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Chargement…</p>
      ) : programs.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Aucun programme pour ce patient. Créez-en un, avec ou sans l&apos;IA.</CardContent></Card>
      ) : (
        programs.map(p => (
          <ProgramCard
            key={p.id}
            program={p}
            onCopy={(phaseId) => copyPatientLink(phaseId, toast).then(load)}
            onEmail={async (phaseId) => {
              const res = await fetch(`/api/exercise-prescriptions/${phaseId}/email`, { method: 'POST' })
              const data = await res.json()
              toast(res.ok ? { title: 'Programme envoyé par email' } : { title: data.error || 'Erreur lors de l’envoi', variant: 'destructive' })
              load()
            }}
            onPdf={async (phaseId) => {
              const res = await fetch(`/api/exercise-prescriptions/${phaseId}/pdf?remise=1`)
              if (!res.ok) { toast({ title: 'Erreur PDF', variant: 'destructive' }); return }
              const url = URL.createObjectURL(await res.blob())
              const a = document.createElement('a')
              a.href = url; a.download = 'programme-exercices.pdf'; a.click()
              URL.revokeObjectURL(url)
              load()
            }}
            onImport={setReportFor}
            onEdit={setEditing}
            onEbp={setEbp}
            onDeletePhase={async (phase) => {
              if (!confirm(`Supprimer l’étape « ${phase.title} » ?`)) return
              await fetch(`/api/exercise-prescriptions/${phase.id}`, { method: 'DELETE' })
              load()
            }}
            onAddPhase={(mode, startsAfterDays) => setCreate({ mode, programId: p.id, startsAfterDays })}
            onDeleteProgram={async () => {
              if (!confirm(`Supprimer le programme « ${p.title} », ses étapes et ses bilans ?`)) return
              for (const ph of p.phases) await fetch(`/api/exercise-prescriptions/${ph.id}`, { method: 'DELETE' })
              toast({ title: 'Programme supprimé' })
              load()
            }}
            onPatch={body => patch(p.id, body)}
            onAssistant={autoNext => setAssistant({ program: p, autoNext })}
          />
        ))
      )}

      <ExercisePrescriptionDialog
        open={create?.mode === 'manual'}
        onClose={() => setCreate(null)}
        patientId={patientId}
        patientName={patientName}
        programId={create?.programId}
        startsAfterDays={create?.startsAfterDays}
        onSaved={() => { setCreate(null); load() }}
      />
      <AiExerciseGenerationDialog
        open={create?.mode === 'ai'}
        onClose={() => setCreate(null)}
        patientId={patientId}
        patientName={patientName}
        programId={create?.programId}
        startsAfterDays={create?.startsAfterDays}
        onSaved={load}
      />
      <ExercisePrescriptionDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        patientId={patientId}
        patientName={patientName}
        prescriptionId={editing?.id}
        initialPrescription={editing ?? undefined}
        onSaved={() => { setEditing(null); load() }}
      />
      <ProgramAssistantDialog
        open={!!assistant}
        onClose={() => setAssistant(null)}
        program={assistant?.program ?? null}
        autoNext={assistant?.autoNext}
        onApplied={load}
      />
      <AdherenceReportDialog open={!!reportFor} onClose={() => setReportFor(null)} prescription={reportFor} onSaved={load} />
      <Dialog open={!!ebp} onOpenChange={o => !o && setEbp(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FlaskConical className="h-4 w-4 text-violet-600" />Justification EBP</DialogTitle></DialogHeader>
          {ebp && <p className="text-sm leading-relaxed whitespace-pre-wrap">{ebp.clinical_notes}</p>}
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface CardProps {
  program: ProgramView
  onCopy: (phaseId: string) => void
  onEmail: (phaseId: string) => void
  onPdf: (phaseId: string) => void
  onImport: (phase: ExercisePrescription) => void
  onEdit: (phase: ExercisePrescription) => void
  onEbp: (phase: ExercisePrescription) => void
  onDeletePhase: (phase: ExercisePrescription) => void
  onAddPhase: (mode: 'manual' | 'ai', startsAfterDays: number) => void
  onDeleteProgram: () => void
  onPatch: (body: Record<string, unknown>) => void
  onAssistant: (autoNext: boolean) => void
}

function ProgramCard({ program: p, onCopy, onEmail, onPdf, onImport, onEdit, onEbp, onDeletePhase, onAddPhase, onDeleteProgram, onPatch, onAssistant }: CardProps) {
  const current = p.phases[p.current_phase]
  const ended = p.status === 'ended'
  const lastStart = Math.max(0, ...p.phases.map(ph => ph.starts_after_days ?? 0))
  const [nextWeek, setNextWeek] = useState(Math.floor(lastStart / 7) + 3)
  const [showHistory, setShowHistory] = useState(false)

  return (
    <Card id={`programme-${p.id}`} className={ended ? 'opacity-75' : ''}>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-lg">{p.title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              Depuis le {frDay(p.start_date, true)}
              {!ended && ` · semaine ${Math.max(1, weekOf(p.start_date))}`}
              {p.phases.length > 1 && !ended && ` · étape ${p.current_phase + 1} sur ${p.phases.length} en cours`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {ended && <Badge variant="outline">Arrêté</Badge>}
            <UsagePill usage={p.usage} />
          </div>
        </div>
        {p.usage.detail && <p className="text-xs text-muted-foreground">{p.usage.detail}</p>}

        {!ended && p.link_out_of_date && (
          <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>Le programme a changé depuis le dernier envoi ({frDay(p.link_sent_at!)}). Renvoyez le lien : le patient a encore l&apos;ancienne version sur son téléphone.</p>
          </div>
        )}
        {!ended && p.link_sent_at && !p.link_out_of_date && (
          <p className="text-xs text-muted-foreground">Lien remis le {frDay(p.link_sent_at)} ({p.link_channel === 'papier' ? 'PDF imprimé' : p.link_channel === 'copie' ? 'lien copié' : 'email'}).</p>
        )}

        {current && (
          <div className="flex flex-wrap gap-2">
            {!ended && (
              <>
                <Button size="sm" variant={p.link_out_of_date || !p.link_sent_at ? 'default' : 'outline'} onClick={() => onCopy(current.id)}><Smartphone className="mr-1.5 h-4 w-4" />Copier le lien patient</Button>
                <Button size="sm" variant="outline" onClick={() => onEmail(current.id)}><Mail className="mr-1.5 h-4 w-4" />Envoyer par email</Button>
                <Button size="sm" variant="outline" onClick={() => onPdf(current.id)}><Download className="mr-1.5 h-4 w-4" />PDF</Button>
                <Button size="sm" variant="outline" onClick={() => onImport({ ...current, program_id: p.id })}><Activity className="mr-1.5 h-4 w-4" />Importer un bilan</Button>
                <Button size="sm" variant="outline" onClick={() => onAssistant(false)}><Bot className="mr-1.5 h-4 w-4 text-primary" />Assistant IA</Button>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={() => onPatch({ status: ended ? 'active' : 'ended' })}>
              {ended ? <><Play className="mr-1.5 h-4 w-4" />Reprendre</> : <><Pause className="mr-1.5 h-4 w-4" />Arrêter</>}
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDeleteProgram}>
              <Trash2 className="mr-1.5 h-4 w-4" />Supprimer
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="grid gap-6 lg:grid-cols-2">
        {/* Étapes */}
        <section className="space-y-3 min-w-0">
          <h3 className="text-sm font-semibold flex items-center gap-2"><CalendarClock className="h-4 w-4" />Étapes</h3>
          <ol className="space-y-3">
            {p.phases.map((ph, k) => (
              <li key={ph.id} className={`rounded-lg border p-3 space-y-2 ${k === p.current_phase && !ended ? 'border-primary/50 bg-primary/5' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Étape {k + 1}
                      {k === p.current_phase && !ended && <span className="ml-2 normal-case tracking-normal text-primary">en cours</span>}
                    </p>
                    <p className="text-sm font-medium">{ph.title}</p>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {ph.clinical_notes && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-violet-600" title="Justification EBP" onClick={() => onEbp(ph)}><FlaskConical className="h-3.5 w-3.5" /></Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Modifier l’étape" onClick={() => onEdit(ph)}><Pencil className="h-3.5 w-3.5" /></Button>
                    {p.phases.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Supprimer l’étape" onClick={() => onDeletePhase(ph)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    )}
                  </div>
                </div>
                <PhaseStart program={p} phaseIndex={k} onChange={days => onPatch({ phases: [{ id: ph.id, starts_after_days: days }] })} />
                <ul className="flex flex-wrap gap-1.5">
                  {(ph.items || []).map(it => (
                    <li key={it.id} className="rounded bg-muted px-2 py-0.5 text-xs">
                      {it.exercise_name}
                      <span className="text-muted-foreground">
                        {it.sets != null && it.reps ? ` · ${it.sets} × ${it.reps}` : it.sets != null ? ` · ${it.sets} séries` : ''}
                        {it.hold_time ? ` · ${it.hold_time} s` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          {!ended && (
            <div className="rounded-lg border border-dashed p-3 space-y-2">
              <p className="text-sm font-medium">Planifier l&apos;étape suivante</p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">À partir de la semaine</span>
                <Input type="number" min={1} max={52} value={nextWeek} onChange={e => setNextWeek(Math.max(1, Number(e.target.value) || 1))} className="h-8 w-20" />
                <span className="text-muted-foreground">({frDay(addDays(p.start_date, (nextWeek - 1) * 7))})</span>
              </div>
              <p className="text-xs text-muted-foreground">L&apos;appli du patient passera d&apos;elle-même à cette étape à la date prévue, une fois le lien renvoyé.</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => onAssistant(true)}><Bot className="mr-1.5 h-4 w-4 text-primary" />Proposer la suite</Button>
                <Button size="sm" variant="outline" onClick={() => onAddPhase('ai', (nextWeek - 1) * 7)}><Sparkles className="mr-1.5 h-4 w-4 text-primary" />Nouvelle étape avec l&apos;IA</Button>
                <Button size="sm" variant="outline" onClick={() => onAddPhase('manual', (nextWeek - 1) * 7)}><Plus className="mr-1.5 h-4 w-4" />Manuellement</Button>
              </div>
            </div>
          )}
        </section>

        {/* Suivi */}
        <section className="space-y-3 min-w-0">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Activity className="h-4 w-4" />Suivi rapporté par le patient</h3>
          {p.reports.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-lg border p-3">
              Aucun bilan importé. En consultation, le patient ouvre l&apos;onglet « Bilan » de son appli : scannez son QR code, tapez son code ou collez le texte qu&apos;il vous a envoyé.
            </p>
          ) : (
            <>
              <FollowUpChart program={p} />
              <WeeksTable weeks={mergeWeeks(p).slice(-6)} />
              <p className="text-xs text-muted-foreground">
                Bilans importés : {p.reports.slice(0, 4).map(r => `${frDay(r.created_at)} (${r.source === 'qr' ? 'QR code' : r.source === 'code' ? 'code tapé' : 'texte collé'})`).join(', ')}
                {p.reports.length > 4 && ` et ${p.reports.length - 4} autres`}
              </p>
            </>
          )}

          <div className="pt-1">
            <button type="button" className="text-sm font-medium flex items-center gap-2 hover:underline" onClick={() => setShowHistory(v => !v)}>
              <History className="h-4 w-4" />Historique des modifications ({p.changes.length})
            </button>
            {showHistory && (
              <ul className="mt-2 space-y-1.5 border-l pl-3">
                {p.changes.map(c => (
                  <li key={c.id} className="text-xs"><span className="text-muted-foreground tabular-nums">{frDay(c.created_at)}</span> · {c.note}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </CardContent>
    </Card>
  )
}

function PhaseStart({ program, phaseIndex, onChange }: { program: ProgramView; phaseIndex: number; onChange: (days: number) => void }) {
  const ph = program.phases[phaseIndex]
  const days = ph.starts_after_days ?? 0
  const [week, setWeek] = useState(Math.floor(days / 7) + 1)
  useEffect(() => setWeek(Math.floor(days / 7) + 1), [days])
  if (phaseIndex === 0) {
    return <p className="text-xs text-muted-foreground">Dès le début, le {frDay(program.start_date)}</p>
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      Dès la semaine
      <Input
        type="number" min={2} max={52} value={week} className="h-7 w-16 text-xs"
        onChange={e => setWeek(Math.max(2, Number(e.target.value) || 2))}
        onBlur={() => { if ((week - 1) * 7 !== days) onChange((week - 1) * 7) }}
      />
      ({frDay(addDays(program.start_date, (week - 1) * 7))})
    </div>
  )
}

/** Une ligne par semaine, en prenant le bilan le plus récent qui la couvre. */
function mergeWeeks(p: ProgramView): WeekSummary[] {
  const byWeek = new Map<number, WeekSummary>()
  for (const r of [...p.reports].reverse()) for (const w of r.weeks) byWeek.set(w.week, w)
  return [...byWeek.values()].sort((a, b) => a.week - b.week)
}

/** Séances par semaine (barres) et douleur au réveil (courbe), étapes marquées. */
function FollowUpChart({ program: p }: { program: ProgramView }) {
  const weeks = mergeWeeks(p)
  const lastWeek = Math.max(weeks[weeks.length - 1]?.week ?? 0, 3)
  const W = 520, H = 190, L = 34, R = 34, T = 16, B = 30
  const n = lastWeek + 1
  const band = (W - L - R) / n
  const X = (w: number) => L + band * w + band / 2
  const maxDone = Math.max(7, ...weeks.map(w => w.done))
  const Yd = (v: number) => T + (H - T - B) * (1 - v / maxDone)
  const Yp = (v: number) => T + (H - T - B) * (1 - v / 10)
  const pain = weeks.filter(w => w.morning != null)
  const line = pain.map((w, k) => `${k ? 'L' : 'M'}${X(w.week).toFixed(1)} ${Yp(w.morning!).toFixed(1)}`).join(' ')
  const phaseStarts = p.phases.map((ph, k) => ({ k, week: Math.floor((ph.starts_after_days ?? 0) / 7) })).filter(s => s.k > 0)

  return (
    <div className="rounded-lg border p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Séances par semaine et douleur au réveil">
        {[0, 5, 10].map(v => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={Yp(v)} y2={Yp(v)} className="stroke-muted" strokeDasharray={v === 5 ? '3 3' : undefined} />
            <text x={W - R + 6} y={Yp(v) + 4} fontSize="10" className="fill-muted-foreground">{v}</text>
          </g>
        ))}
        {[0, Math.round(maxDone / 2), maxDone].map(v => (
          <text key={`d${v}`} x={L - 6} y={Yd(v) + 4} fontSize="10" textAnchor="end" className="fill-muted-foreground">{v}</text>
        ))}
        {weeks.map(w => (
          <rect key={w.week} x={X(w.week) - band * 0.3} width={band * 0.6} y={Yd(w.done)} height={Yd(0) - Yd(w.done)} rx="2" className="fill-primary/25">
            <title>{`Semaine ${w.week + 1} : ${w.done} séance${w.done > 1 ? 's' : ''}`}</title>
          </rect>
        ))}
        {phaseStarts.map(s => (
          <g key={s.k}>
            <line x1={L + band * s.week} x2={L + band * s.week} y1={T - 6} y2={H - B} className="stroke-violet-500" strokeDasharray="4 3" />
            <text x={L + band * s.week + 3} y={T + 2} fontSize="10" className="fill-violet-600">Étape {s.k + 1}</text>
          </g>
        ))}
        {pain.length > 1 && <path d={line} fill="none" className="stroke-primary" strokeWidth="2" strokeLinejoin="round" />}
        {pain.map(w => (
          <circle key={`p${w.week}`} cx={X(w.week)} cy={Yp(w.morning!)} r="3" className="fill-primary">
            <title>{`Semaine ${w.week + 1} : douleur au réveil ${String(w.morning).replace('.', ',')}/10`}</title>
          </circle>
        ))}
        {Array.from({ length: n }, (_, w) => (n <= 12 || w % 2 === 0) && (
          <text key={`w${w}`} x={X(w)} y={H - 12} fontSize="10" textAnchor="middle" className="fill-muted-foreground">S{w + 1}</text>
        ))}
      </svg>
      <div className="flex flex-wrap gap-4 px-2 pb-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary/25" />Séances faites (axe de gauche)</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-primary" />Douleur au réveil sur 10 (axe de droite)</span>
      </div>
    </div>
  )
}
