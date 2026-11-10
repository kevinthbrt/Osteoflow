'use client'

/**
 * Import dédié OsteoTools : le praticien dépose l'archive .zip reçue
 * d'OsteoTools et saisit son mot de passe. L'archive est d'abord analysée
 * (simulation, rien n'est enregistré), puis importée après confirmation des
 * modes de règlement.
 */

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { localApiHeaders } from '@/lib/local-api-token'
import { AlertCircle, CheckCircle2, FileArchive, Loader2, RotateCcw } from 'lucide-react'

type Step = 'select' | 'analyzing' | 'review' | 'importing' | 'done'
type Target = 'card' | 'cash' | 'check' | 'transfer' | 'other' | 'free'

interface PaymentMode {
  code: string
  count: number
  total: number
  firstYear: string
  lastYear: string
  target: Target
}

interface Report {
  patientsCreated: number
  patientsMerged: number
  patientsAlreadyImported: number
  historyEntriesCreated: number
  consultationsCreated: number
  consultationsMerged: number
  consultationsAlreadyImported: number
  invoicesCreated: number
  invoicesSkippedExisting: number
  paymentsCreated: number
  attachmentsCreated: number
}

interface ImportResponse {
  action: 'analyze' | 'import'
  stats: {
    patients: number
    consultations: number
    invoices: number
    historyEntries: number
    attachments: number
    firstConsultation: string | null
    lastConsultation: string | null
    consultationTimesFromAgenda: number
  }
  paymentModes: PaymentMode[]
  report: Report
  backupPath: string | null
}

const TARGET_LABELS: Record<Target, string> = {
  card: 'Carte bancaire',
  cash: 'Espèces',
  check: 'Chèque',
  transfer: 'Virement',
  other: 'Autre',
  free: 'Gratuit (sans règlement)',
}

const nf = new Intl.NumberFormat('fr-FR')
const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

function frenchDate(day: string | null): string {
  if (!day) return '?'
  const [y, m, d] = day.split('-')
  return `${d}/${m}/${y}`
}

export function OsteoToolsImportCard() {
  const [step, setStep] = useState<Step>('select')
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [analysis, setAnalysis] = useState<ImportResponse | null>(null)
  const [targets, setTargets] = useState<Record<string, Target>>({})
  const [result, setResult] = useState<ImportResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const send = async (action: 'analyze' | 'import'): Promise<ImportResponse | null> => {
    if (!file) return null
    const form = new FormData()
    form.append('file', file)
    form.append('password', password)
    form.append('action', action)
    form.append('paymentTargets', JSON.stringify(targets))
    const res = await fetch('/api/import/osteotools', { method: 'POST', body: form, headers: await localApiHeaders() })
    const body = await res.json().catch(() => ({ error: 'Réponse illisible.' }))
    if (!res.ok) {
      setError(body.error || 'Erreur inconnue.')
      return null
    }
    setError(null)
    return body as ImportResponse
  }

  const analyze = async () => {
    setStep('analyzing')
    const data = await send('analyze')
    if (!data) {
      setStep('select')
      return
    }
    setAnalysis(data)
    setTargets(Object.fromEntries(data.paymentModes.map((m) => [m.code, m.target])))
    setStep('review')
  }

  const runImport = async () => {
    setStep('importing')
    const data = await send('import')
    if (!data) {
      setStep('review')
      return
    }
    setResult(data)
    setStep('done')
    toast({
      variant: 'success',
      title: 'Import OsteoTools terminé',
      description: `${nf.format(data.report.patientsCreated + data.report.patientsMerged)} patients, ${nf.format(data.report.consultationsCreated + data.report.consultationsMerged)} séances.`,
    })
  }

  const reset = () => {
    setStep('select')
    setFile(null)
    setPassword('')
    setAnalysis(null)
    setResult(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const busy = step === 'analyzing' || step === 'importing'

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileArchive className="h-5 w-5 text-primary" />
          Vous venez d&apos;OsteoTools ?
        </CardTitle>
        <CardDescription>
          Déposez l&apos;archive .zip fournie par OsteoTools telle quelle, avec son mot de passe. Patients,
          antécédents, séances, factures, règlements et documents sont repris automatiquement, sans
          correspondance de colonnes à faire. Si vous aviez déjà importé des patients, ils sont complétés
          et corrigés, pas dupliqués.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {(step === 'select' || step === 'analyzing') && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="osteotools-file">Archive OsteoTools (.zip)</Label>
              <Input
                id="osteotools-file"
                ref={inputRef}
                type="file"
                accept=".zip,application/zip"
                disabled={busy}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="osteotools-password">Mot de passe de l&apos;archive</Label>
              <Input
                id="osteotools-password"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="Communiqué par OsteoTools"
                value={password}
                disabled={busy}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Button onClick={analyze} disabled={!file || busy}>
                {step === 'analyzing' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {step === 'analyzing' ? 'Analyse en cours…' : 'Analyser l\'archive'}
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                L&apos;analyse ne modifie rien : elle vous montre ce qui sera importé avant de confirmer.
              </p>
            </div>
          </div>
        )}

        {(step === 'review' || step === 'importing') && analysis && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Patients" value={analysis.stats.patients} />
              <Stat label="Séances" value={analysis.stats.consultations} />
              <Stat label="Factures" value={analysis.stats.invoices} />
              <Stat label="Antécédents" value={analysis.report.historyEntriesCreated} />
              <Stat label="Documents joints" value={analysis.stats.attachments} />
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Période</p>
                <p className="text-sm font-medium">
                  {frenchDate(analysis.stats.firstConsultation)} au {frenchDate(analysis.stats.lastConsultation)}
                </p>
              </div>
            </div>

            {(analysis.report.patientsMerged > 0 || analysis.report.patientsAlreadyImported > 0) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                <p className="font-medium">Données déjà présentes dans MyOsteoflow</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {analysis.report.patientsMerged > 0 && (
                    <li>
                      {nf.format(analysis.report.patientsMerged)} patient(s) déjà créé(s) seront complétés et corrigés
                      (sexe, date de naissance, téléphone…), sans doublon.
                    </li>
                  )}
                  {analysis.report.consultationsMerged > 0 && (
                    <li>
                      {nf.format(analysis.report.consultationsMerged)} séance(s) du même jour seront complétées avec le
                      contenu OsteoTools. Ce que vous avez saisi vous-même est conservé.
                    </li>
                  )}
                  {analysis.report.patientsAlreadyImported > 0 && (
                    <li>
                      {nf.format(analysis.report.patientsAlreadyImported)} patient(s) proviennent déjà de cette archive : ils
                      ne seront pas recréés.
                    </li>
                  )}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Modes de règlement</h4>
              <p className="text-xs text-muted-foreground">
                OsteoTools enregistre le mode de règlement sous forme de code. Vérifiez la correspondance proposée
                (les montants et les années vous aident à reconnaître chaque mode), elle alimente votre comptabilité.
              </p>
              <div className="divide-y rounded-lg border">
                {analysis.paymentModes.map((mode) => (
                  <div key={mode.code} className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <div className="text-sm">
                      <p className="font-medium">Code OsteoTools {mode.code}</p>
                      <p className="text-xs text-muted-foreground">
                        {nf.format(mode.count)} facture(s), {euros.format(mode.total)}
                        {mode.firstYear ? `, de ${mode.firstYear} à ${mode.lastYear}` : ''}
                      </p>
                    </div>
                    <Select
                      value={targets[mode.code]}
                      onValueChange={(value) => setTargets((prev) => ({ ...prev, [mode.code]: value as Target }))}
                      disabled={busy}
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(TARGET_LABELS) as Target[]).map((t) => (
                          <SelectItem key={t} value={t}>{TARGET_LABELS[t]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Une copie de sécurité de votre base est faite automatiquement juste avant l&apos;import. L&apos;import
              est réalisé en une seule fois : en cas d&apos;erreur, rien n&apos;est modifié. Vous pouvez le relancer
              sans risque de doublon.
            </p>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={reset} disabled={busy}>Annuler</Button>
              <Button onClick={runImport} disabled={busy}>
                {step === 'importing' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {step === 'importing' ? 'Import en cours…' : 'Importer dans MyOsteoflow'}
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              <p className="font-medium">Import terminé</p>
            </div>
            <ul className="space-y-1 text-sm">
              <li>{nf.format(result.report.patientsCreated)} patient(s) créé(s), {nf.format(result.report.patientsMerged)} complété(s)</li>
              <li>{nf.format(result.report.historyEntriesCreated)} antécédent(s)</li>
              <li>{nf.format(result.report.consultationsCreated)} séance(s) créée(s), {nf.format(result.report.consultationsMerged)} complétée(s)</li>
              <li>{nf.format(result.report.invoicesCreated)} facture(s) et {nf.format(result.report.paymentsCreated)} règlement(s)</li>
              <li>{nf.format(result.report.attachmentsCreated)} document(s) joint(s)</li>
            </ul>
            {result.backupPath && (
              <p className="text-xs text-muted-foreground">
                Copie de sécurité de la base avant import : <code className="break-all">{result.backupPath}</code>
              </p>
            )}
            <div className="flex gap-3">
              <Button asChild>
                <a href="/patients">Voir les patients</a>
              </Button>
              <Button variant="outline" onClick={reset}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Nouvel import
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{nf.format(value)}</p>
    </div>
  )
}
