'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  ExternalLink,
  Home,
  Loader2,
  RefreshCw,
  Download,
} from 'lucide-react'

const DOCTOLIB_HOME = 'https://pro.doctolib.fr'
const DOCTOLIB_CALENDAR = 'https://pro.doctolib.fr/calendar/today/day'

// Script injected into the Doctolib webview to scrape today's appointments
const SCRAPE_CALENDAR_SCRIPT = `
(function() {
  try {
    const appointments = [];
    const seen = new Set();

    // Doctolib uses .dc-event for appointment blocks
    // Text format: "HH:MM\\nLASTNAME\\nFirstname\\n@" (newline-separated)
    const events = document.querySelectorAll('.dc-event');

    for (const el of events) {
      const lines = (el.innerText || '').split('\\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) continue;

      // First line should be the time (HH:MM)
      const timeMatch = lines[0].match(/^(\\d{1,2})[h:](\\d{2})$/);
      if (!timeMatch) continue;

      const time = timeMatch[1].padStart(2, '0') + ':' + timeMatch[2];

      // Remaining lines are name parts (last name, first name, possibly @ or icons)
      // Filter out single-char lines like "@"
      const nameParts = lines.slice(1).filter(l => l.length > 1);
      if (nameParts.length === 0) continue;

      let lastName = nameParts[0] || '';
      let firstName = nameParts.length > 1 ? nameParts[1] : '';
      const fullName = (lastName + ' ' + firstName).trim();

      const key = time + '|' + fullName;
      if (seen.has(key)) continue;
      seen.add(key);

      appointments.push({ time, fullName, lastName, firstName });
    }

    // Sort by time
    appointments.sort((a, b) => a.time.localeCompare(b.time));

    return JSON.stringify({
      success: true,
      date: new Date().toISOString().slice(0, 10),
      count: appointments.length,
      appointments,
    });
  } catch (err) {
    return JSON.stringify({ success: false, error: err.message });
  }
})();
`

// Script to scrape patient details from an open appointment overlay
// Doctolib puts labels and values on separate lines:
// "Tél (portable) : "  -> next line -> "06 87 93 86 04"
// "E-mail : "           -> next line -> "email@example.com"
const SCRAPE_PATIENT_SCRIPT = `
(function() {
  try {
    const patient = {};
    const lines = document.body.innerText.split('\\n').map(l => l.trim()).filter(Boolean);

    // Helper: find value on the line after a label
    function getValueAfterLabel(label) {
      for (let i = 0; i < lines.length - 1; i++) {
        if (lines[i].toLowerCase().includes(label.toLowerCase())) {
          const val = lines[i + 1];
          if (val && val !== 'Ajouter' && val.length > 1) return val;
        }
      }
      return null;
    }

    // Last name + First name (lines after "Madame"/"Monsieur")
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === 'Madame' || lines[i] === 'Monsieur') {
        if (lines[i + 1]) patient.lastName = lines[i + 1];
        if (lines[i + 2]) patient.firstName = lines[i + 2];
        break;
      }
    }

    // Gender + birth date: "F, 22/12/1987 (38 ans)"
    for (const line of lines) {
      const m = line.match(/^([MF]),\\s*(\\d{2}\\/\\d{2}\\/\\d{4})\\s*\\((\\d+)\\s*ans\\)/);
      if (m) {
        patient.gender = m[1];
        patient.birthDate = m[2];
        patient.age = parseInt(m[3]);
        break;
      }
    }

    // Phone
    const phone = getValueAfterLabel('Tél (portable)') || getValueAfterLabel('Tél (fixe)');
    if (phone) patient.phone = phone;

    // Email
    const email = getValueAfterLabel('E-mail');
    if (email && email.includes('@')) patient.email = email;

    // Médecin traitant
    const doctor = getValueAfterLabel('Médecin traitant');
    if (doctor) patient.primaryPhysician = doctor;

    // Lieu de naissance
    const birthPlace = getValueAfterLabel('Lieu de naissance');
    if (birthPlace) patient.birthPlace = birthPlace;

    const hasData = patient.lastName || patient.phone || patient.email || patient.birthDate;
    return JSON.stringify({ success: hasData, patient });
  } catch (err) {
    return JSON.stringify({ success: false, error: err.message });
  }
})();
`

export interface DoctolibAppointment {
  time: string
  fullName: string
  lastName: string
  firstName: string
}

export interface DoctolibSyncData {
  date: string
  syncedAt: string
  appointments: DoctolibAppointment[]
}

export default function DoctolibPage() {
  const webviewRef = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [currentUrl, setCurrentUrl] = useState(DOCTOLIB_HOME)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [isElectron, setIsElectron] = useState(false)
  const [syncCount, setSyncCount] = useState<number | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    setIsElectron(!!(window as any).electronAPI?.isDesktop)
  }, [])

  useEffect(() => {
    if (!isElectron) return
    const webview = webviewRef.current
    if (!webview) return

    const handleStartLoading = () => setIsLoading(true)
    const handleStopLoading = () => {
      setIsLoading(false)
      setCanGoBack(webview.canGoBack())
      setCanGoForward(webview.canGoForward())
      setCurrentUrl(webview.getURL())
    }

    webview.addEventListener('did-start-loading', handleStartLoading)
    webview.addEventListener('did-stop-loading', handleStopLoading)

    return () => {
      webview.removeEventListener('did-start-loading', handleStartLoading)
      webview.removeEventListener('did-stop-loading', handleStopLoading)
    }
  }, [isElectron])

  // Load sync count from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('doctolib_sync')
      if (stored) {
        const data: DoctolibSyncData = JSON.parse(stored)
        const today = new Date().toISOString().slice(0, 10)
        if (data.date === today) {
          setSyncCount(data.appointments.length)
        }
      }
    } catch { /* ignore */ }
  }, [])

  const handleSyncCalendar = useCallback(async () => {
    const webview = webviewRef.current
    if (!webview) return

    setIsSyncing(true)

    try {
      // First navigate to today's calendar if not already there
      const currentWebviewUrl = webview.getURL()
      if (!currentWebviewUrl.includes('/calendar')) {
        webview.loadURL(DOCTOLIB_CALENDAR)
        // Wait for page to load
        await new Promise<void>((resolve) => {
          const handler = () => {
            webview.removeEventListener('did-stop-loading', handler)
            // Wait a bit more for React to render
            setTimeout(resolve, 2000)
          }
          webview.addEventListener('did-stop-loading', handler)
        })
      } else {
        // Wait for any pending renders
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      const resultStr = await webview.executeJavaScript(SCRAPE_CALENDAR_SCRIPT)
      const result = JSON.parse(resultStr)

      if (result.success) {
        const syncData: DoctolibSyncData = {
          date: result.date,
          syncedAt: new Date().toISOString(),
          appointments: result.appointments,
        }
        localStorage.setItem('doctolib_sync', JSON.stringify(syncData))
        setSyncCount(result.count)

        toast({
          variant: 'success',
          title: 'Agenda synchronis\u00e9',
          description: `${result.count} rendez-vous trouv\u00e9${result.count > 1 ? 's' : ''} pour aujourd'hui`,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Erreur de synchronisation',
          description: result.error || 'Impossible de lire l\'agenda. Assurez-vous d\'\u00eatre connect\u00e9 \u00e0 Doctolib.',
        })
      }
    } catch (error) {
      console.error('Doctolib sync error:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur de synchronisation',
        description: 'Assurez-vous d\'\u00eatre connect\u00e9 \u00e0 Doctolib et sur la page agenda.',
      })
    } finally {
      setIsSyncing(false)
    }
  }, [toast])

  const handleImportPatient = useCallback(async () => {
    const webview = webviewRef.current
    if (!webview) return

    try {
      const resultStr = await webview.executeJavaScript(SCRAPE_PATIENT_SCRIPT)
      const result = JSON.parse(resultStr)

      if (result.success && result.patient) {
        localStorage.setItem('doctolib_patient_import', JSON.stringify(result.patient))
        toast({
          variant: 'success',
          title: 'Infos patient r\u00e9cup\u00e9r\u00e9es',
          description: 'Les informations ont \u00e9t\u00e9 copi\u00e9es. Allez cr\u00e9er un nouveau patient pour les utiliser.',
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Aucune info trouv\u00e9e',
          description: 'Ouvrez d\'abord un rendez-vous dans Doctolib pour voir la fiche patient.',
        })
      }
    } catch (error) {
      console.error('Patient import error:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de r\u00e9cup\u00e9rer les informations du patient.',
      })
    }
  }, [toast])

  if (!isElectron) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] text-center">
        <ExternalLink className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Doctolib</h2>
        <p className="text-muted-foreground mb-4">
          L&apos;int&eacute;gration Doctolib est disponible uniquement dans l&apos;application de bureau.
        </p>
        <Button asChild variant="outline">
          <a href={DOCTOLIB_HOME} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Ouvrir Doctolib dans le navigateur
          </a>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-6">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-background">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => webviewRef.current?.goBack()}
          disabled={!canGoBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => webviewRef.current?.goForward()}
          disabled={!canGoForward}
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => webviewRef.current?.reload()}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCw className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => webviewRef.current?.loadURL(DOCTOLIB_CALENDAR)}
        >
          <Home className="h-4 w-4" />
        </Button>
        <Input
          value={currentUrl}
          readOnly
          className="flex-1 text-xs h-8 bg-muted/50"
        />

        {/* Import patient info button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleImportPatient}
          title="Importer les infos du patient affiché"
        >
          <Download className="mr-1 h-4 w-4" />
          Importer patient
        </Button>

        {/* Sync button */}
        <Button
          variant="default"
          size="sm"
          onClick={handleSyncCalendar}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-4 w-4" />
          )}
          Synchroniser
          {syncCount !== null && (
            <Badge variant="secondary" className="ml-2">
              {syncCount}
            </Badge>
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const url = webviewRef.current?.getURL() || DOCTOLIB_HOME
            window.open(url, '_blank')
          }}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>

      {/* Webview */}
      <div className="flex-1 relative">
        <webview
          ref={webviewRef}
          src={DOCTOLIB_CALENDAR}
          style={{ width: '100%', height: '100%' }}
          partition="persist:doctolib"
        />
      </div>
    </div>
  )
}
