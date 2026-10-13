'use client'

import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Camera, Keyboard, ClipboardPaste, Loader2, Activity } from 'lucide-react'
import { parseReportInput, matchesPrescription, reportHeadline, type ParsedReport } from '@/lib/exercises/adherence'
import type { WeekSummary } from '@/lib/exercises/patient-link-codec'

type Source = 'qr' | 'code' | 'texte'

interface Props {
  open: boolean
  onClose: () => void
  prescription: { id: string; title: string } | null
  onSaved: () => void
}

/**
 * Import du bilan de l'appli patient. Trois voies, pour les cabinets sans
 * webcam : scanner le QR code, taper le code court, ou coller le texte que
 * le patient a envoyé par message.
 */
export function AdherenceReportDialog({ open, onClose, prescription, onSaved }: Props) {
  const { toast } = useToast()
  const [tab, setTab] = useState<Source>('code')
  const [code, setCode] = useState('')
  const [text, setText] = useState('')
  const [scanned, setScanned] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) { setCode(''); setText(''); setScanned(null); return }
    // Caméra présente : le scan est proposé en premier.
    navigator.mediaDevices?.enumerateDevices?.()
      .then(devices => { if (devices.some(d => d.kind === 'videoinput')) setTab('qr') })
      .catch(() => {})
  }, [open])

  const input = tab === 'qr' ? scanned ?? '' : tab === 'code' ? code : text
  const parsed = input.trim() ? parseReportInput(input) : null
  const wrongProgram = parsed && prescription ? !matchesPrescription(parsed, prescription.id) : false

  async function save() {
    if (!prescription || !parsed || wrongProgram) return
    setSaving(true)
    try {
      const res = await fetch(`/api/exercise-prescriptions/${prescription.id}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, source: tab }),
      })
      const data = await res.json()
      if (!res.ok) { toast({ title: data.error || 'Erreur lors de l’enregistrement', variant: 'destructive' }); return }
      toast({ title: 'Bilan enregistré dans le dossier' })
      onSaved()
      onClose()
    } catch {
      toast({ title: 'Erreur réseau', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Importer le bilan du patient
          </DialogTitle>
          {prescription && <p className="text-sm text-muted-foreground">{prescription.title}</p>}
        </DialogHeader>

        <Tabs value={tab} onValueChange={v => setTab(v as Source)}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="qr"><Camera className="h-4 w-4 mr-1.5" />Scanner</TabsTrigger>
            <TabsTrigger value="code"><Keyboard className="h-4 w-4 mr-1.5" />Taper le code</TabsTrigger>
            <TabsTrigger value="texte"><ClipboardPaste className="h-4 w-4 mr-1.5" />Coller</TabsTrigger>
          </TabsList>

          <TabsContent value="qr" className="space-y-2">
            {open && tab === 'qr' && !scanned && <QrScanner onResult={setScanned} />}
            {scanned && (
              <Button variant="outline" size="sm" onClick={() => setScanned(null)}>Scanner à nouveau</Button>
            )}
            <p className="text-xs text-muted-foreground">
              Le patient ouvre l’onglet « Bilan » de son appli et présente le QR code devant la caméra.
            </p>
          </TabsContent>

          <TabsContent value="code" className="space-y-2">
            <Input
              autoFocus
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="ex. CZZM-28ZY-9J0Y"
              className="font-mono text-lg tracking-wider"
              spellCheck={false}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Le code s’affiche sous le QR code dans l’onglet « Bilan » de l’appli. Il résume les 8 dernières semaines.
              {code.trim() && !parsed && ' Code incomplet ou faute de frappe : vérifiez chaque caractère.'}
            </p>
          </TabsContent>

          <TabsContent value="texte" className="space-y-2">
            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={4}
              placeholder="Collez ici le message du patient (il contient « B1. » suivi de lettres et de chiffres)"
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Depuis l’appli, le patient peut copier son bilan et vous l’envoyer par email ou SMS. Le texte donne le détail jour par jour.
              {text.trim() && !parsed && ' Aucun bilan reconnu dans ce texte.'}
            </p>
          </TabsContent>
        </Tabs>

        {parsed && <ReportPreview parsed={parsed} wrongProgram={wrongProgram} />}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={!parsed || wrongProgram || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer dans le dossier
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ReportPreview({ parsed, wrongProgram }: { parsed: ParsedReport; wrongProgram: boolean }) {
  if (wrongProgram) {
    return (
      <p className="rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-sm p-3">
        Ce bilan correspond à un autre programme. Ouvrez l’import depuis le bon programme.
      </p>
    )
  }
  const target = parsed.kind === 'full' ? parsed.report.n : undefined
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <p className="text-sm font-medium">{reportHeadline(parsed.weeks, target)}</p>
      <WeeksTable weeks={parsed.weeks} target={target} />
      {parsed.kind === 'short' && (
        <p className="text-xs text-muted-foreground">Le code court donne un résumé par semaine ; le QR code et le texte donnent le détail jour par jour.</p>
      )}
    </div>
  )
}

export function WeeksTable({ weeks, target }: { weeks: WeekSummary[]; target?: number }) {
  const f = (v: number | null) => (v == null ? 'non noté' : `${String(v).replace('.', ',')}/10`)
  return (
    <table className="w-full text-xs tabular-nums">
      <thead>
        <tr className="text-muted-foreground text-left">
          <th className="font-medium py-1">Semaine</th>
          <th className="font-medium py-1">Séances</th>
          <th className="font-medium py-1">Douleur au réveil</th>
          <th className="font-medium py-1">Max en séance</th>
        </tr>
      </thead>
      <tbody>
        {weeks.map(w => (
          <tr key={w.week} className="border-t">
            <td className="py-1">{w.week + 1}</td>
            <td className="py-1">
              <span className="inline-flex items-center gap-2">
                {w.done}{target ? ` / ${target}` : ''}
                {target ? (
                  <span className="inline-block h-1.5 w-14 rounded-full bg-muted overflow-hidden">
                    <span className="block h-full bg-primary" style={{ width: `${Math.min(100, (w.done / target) * 100)}%` }} />
                  </span>
                ) : null}
              </span>
            </td>
            <td className="py-1">{f(w.morning)}</td>
            <td className={`py-1 ${w.maxPain != null && w.maxPain > 5 ? 'text-amber-700 dark:text-amber-300 font-medium' : ''}`}>{f(w.maxPain)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function QrScanner({ onResult }: { onResult: (text: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setInterval> | null = null
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then(s => {
        stream = s
        if (!video.current) return
        video.current.srcObject = s
        video.current.play().catch(() => {})
        timer = setInterval(() => {
          const v = video.current
          if (!v || !ctx || v.readyState < 2) return
          canvas.width = v.videoWidth
          canvas.height = v.videoHeight
          ctx.drawImage(v, 0, 0)
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
          if (hit?.data && /B1\.[A-Za-z0-9_-]+/.test(hit.data)) onResult(hit.data)
        }, 300)
      })
      .catch(() => setError('Caméra indisponible. Utilisez le code court ou collez le texte du patient.'))

    return () => {
      if (timer) clearInterval(timer)
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [onResult])

  if (error) return <p className="text-sm text-muted-foreground rounded-md border p-3">{error}</p>
  return (
    <div className="relative overflow-hidden rounded-lg border bg-black aspect-video">
      <video ref={video} muted playsInline className="h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 m-auto h-40 w-40 rounded-lg border-2 border-white/80" />
    </div>
  )
}
