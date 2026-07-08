'use client'

import { useEffect, useState } from 'react'
import { HardDrive, Download, AlertTriangle, Clock, ShieldCheck } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { localApiHeaders } from '@/lib/local-api-token'

const REMINDER_INTERVAL_DAYS = 7
// Delay after login (CGU already accepted, tour already seen) before showing the reminder
const CHECK_DELAY_MS = 4000
// Safety net: if the guided tour never fires its completion event (error, page
// navigated away, etc.), show the backup check anyway after this long instead
// of waiting forever.
const TOUR_FALLBACK_TIMEOUT_MS = 120000

type Mode = 'first_time' | 'reminder'

export function BackupReminderDialog() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('first_time')
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    let fallbackTimer: ReturnType<typeof setTimeout>

    const scheduleCheck = (delayMs: number) => {
      timer = setTimeout(async () => {
        try {
          const res = await fetch('/api/settings/database/backup-status')
          if (!res.ok) return
          const { lastBackupDate: last, snoozedUntil } = await res.json() as {
            lastBackupDate: string | null
            snoozedUntil: string | null
          }

          if (snoozedUntil && new Date(snoozedUntil) > new Date()) return

          setLastBackupDate(last)

          if (!last) {
            setMode('first_time')
            setOpen(true)
            return
          }

          const daysSince = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24)
          if (daysSince >= REMINDER_INTERVAL_DAYS) {
            setMode('reminder')
            setOpen(true)
          }
        } catch {
          // fail silently
        }
      }, delayMs)
    }

    // On a brand-new cabinet the guided tour runs first. Wait for it to finish
    // (or skip the wait if it was already seen in a previous session) so this
    // dialog never pops up on top of / interrupts the tour.
    const waitForTourThenCheck = () => {
      fetch('/api/tour/status')
        .then((r) => r.json())
        .then((d) => {
          if (d.seen) {
            scheduleCheck(CHECK_DELAY_MS)
            return
          }
          const onTourCompleted = () => scheduleCheck(CHECK_DELAY_MS)
          window.addEventListener('tour-completed', onTourCompleted, { once: true })
          fallbackTimer = setTimeout(() => {
            window.removeEventListener('tour-completed', onTourCompleted)
            scheduleCheck(0)
          }, TOUR_FALLBACK_TIMEOUT_MS)
        })
        .catch(() => scheduleCheck(CHECK_DELAY_MS))
    }

    // Only show after CGU is accepted — avoids stacking on top of the legal modal
    fetch('/api/legal/status')
      .then((r) => r.json())
      .then((d) => {
        if (d.accepted) {
          waitForTourThenCheck()
        } else {
          // CGU not yet accepted: wait for it, then wait for the tour as above
          window.addEventListener('cgu-accepted', waitForTourThenCheck, { once: true })
        }
      })
      .catch(() => scheduleCheck(CHECK_DELAY_MS))

    // Ouverture manuelle — via le bouton « Sauvegarde » de l'en-tête ou via le
    // clic sur la notification quotidienne (IPC Electron).
    const openManually = () => {
      fetch('/api/settings/database/backup-status')
        .then((r) => r.json())
        .then(({ lastBackupDate: last }) => {
          setLastBackupDate(last)
          setMode(last ? 'reminder' : 'first_time')
          setOpen(true)
        })
        .catch(() => { setMode('first_time'); setOpen(true) })
    }
    window.addEventListener('open-backup-dialog', openManually)
    const api = (window as unknown as { electronAPI?: { onOpenBackupReminder?: (cb: () => void) => void } }).electronAPI
    api?.onOpenBackupReminder?.(openManually)

    return () => {
      clearTimeout(timer)
      clearTimeout(fallbackTimer)
      window.removeEventListener('open-backup-dialog', openManually)
    }
  }, [])

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      const res = await fetch('/api/settings/database/backup', { headers: await localApiHeaders() })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `myosteoflow-backup-${new Date().toISOString().split('T')[0]}.db`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: 'Sauvegarde téléchargée', description: 'Conservez ce fichier sur un disque externe ou une clé USB. Ne le déposez jamais sur un cloud.' })
      setOpen(false)
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de créer la sauvegarde.' })
    } finally {
      setIsDownloading(false)
    }
  }

  const handleSnooze = async () => {
    await fetch('/api/settings/database/backup-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'snooze' }),
    })
    setOpen(false)
  }

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const daysSince = lastBackupDate
    ? Math.floor((Date.now() - new Date(lastBackupDate).getTime()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleSnooze() }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            {mode === 'first_time' ? (
              <div className="p-2.5 rounded-full bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
            ) : (
              <div className="p-2.5 rounded-full bg-blue-100">
                <HardDrive className="h-5 w-5 text-blue-600" />
              </div>
            )}
            <DialogTitle className="text-lg">
              {mode === 'first_time' ? 'Protégez vos données patients' : 'Mise à jour de votre sauvegarde'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm leading-relaxed">
            {mode === 'first_time' ? (
              <>
                Aucune sauvegarde n&apos;a encore été créée. En cas de panne de disque dur, <strong>toutes vos données patients seraient perdues définitivement</strong>.
              </>
            ) : (
              <>
                Votre dernière sauvegarde date du <strong>{formatDate(lastBackupDate!)}</strong>
                {daysSince !== null && daysSince > 0 && ` (il y a ${daysSince} jour${daysSince > 1 ? 's' : ''})`}.
                Pensez à la mettre à jour régulièrement.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 p-3 bg-muted/50 rounded-lg space-y-1.5 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
            <span>Téléchargez le fichier et copiez-le sur un <strong>disque externe</strong> ou une <strong>clé USB</strong> conservés dans un endroit sûr</span>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
            <span>Pour des raisons de confidentialité des données patients, il est <strong>interdit de déposer ce fichier sur un cloud</strong> (Google Drive, iCloud, Dropbox…)</span>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-1">
          <Button variant="outline" size="sm" onClick={handleSnooze} className="w-full sm:w-auto flex items-center justify-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Rappeler dans 3 jours</span>
          </Button>
          <Button size="sm" onClick={handleDownload} disabled={isDownloading} className="w-full sm:w-auto flex items-center justify-center gap-1.5">
            <Download className="h-4 w-4 shrink-0" />
            <span className="truncate">{isDownloading ? 'Téléchargement…' : 'Télécharger la sauvegarde'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
