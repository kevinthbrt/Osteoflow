'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CalendarArrowDown, Check, ChevronDown, Copy, ExternalLink, Loader2, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { copyText } from '@/lib/utils/clipboard'
import { useDoctolibStatus, useDoctolibStoreUrl } from '@/lib/doctolib/use-doctolib-feature'
import { TUTORIALS } from '@/lib/tutorials'

/**
 * Mise en route de l'extension Doctolib : installation, connexion
 * (automatique, l'extension se présente à Osteoflow), première
 * synchronisation. L'état se met à jour tout seul pendant l'installation.
 */
const DOCTOLIB_URL = 'https://pro.doctolib.fr'
const DISMISS_KEY = 'myosteoflow_doctolib_setup_dismissed'
const APP_HEADERS = { 'x-osteoflow-app': '1' }

function ago(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: fr })
}

function Step({ index, done, active, title, children }: {
  index: number
  done: boolean
  active: boolean
  title: string
  children?: React.ReactNode
}) {
  return (
    <li className="flex gap-3">
      <span
        className={cn(
          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
          done ? 'bg-success text-white' : active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        )}
      >
        {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index}
      </span>
      <div className={cn('min-w-0 flex-1 space-y-2', !done && !active && 'opacity-60')}>
        <p className={cn('text-sm font-medium', done && 'text-muted-foreground')}>{title}</p>
        {active && children}
      </div>
    </li>
  )
}

function ManualPairing() {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState<string | null>(null)

  const load = async (regenerate = false) => {
    const res = await fetch('/api/doctolib/pairing', { method: regenerate ? 'POST' : 'GET', headers: APP_HEADERS })
    const data = (await res.json()) as { code?: string }
    setCode(data.code ?? null)
  }

  return (
    <div className="text-sm">
      <button
        type="button"
        className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
        onClick={() => {
          setOpen((value) => !value)
          if (!code) load()
        }}
        aria-expanded={open}
      >
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
        Connexion manuelle (code d’appairage)
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <p className="text-[13px] text-muted-foreground">
            À utiliser seulement si l’extension ne se connecte pas seule : icône de l’extension, « Réglages », puis collez ce
            code. Il empêche tout autre site d’envoyer des données à Osteoflow.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="select-all rounded-lg bg-muted px-3 py-1.5 font-mono text-base font-semibold tracking-widest">
              {code ?? '…'}
            </code>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              disabled={!code}
              onClick={async () => {
                if (!code) return
                const ok = await copyText(code)
                toast(ok
                  ? { title: 'Code copié', variant: 'success' }
                  : { title: 'Copie impossible', description: 'Sélectionnez le code et copiez-le avec Cmd + C (Ctrl + C sur PC).', variant: 'destructive' })
              }}
            >
              <Copy className="h-4 w-4" />
              Copier
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => load(true)}
              title="L’ancien code cesse de fonctionner : l’extension se reconnectera seule à sa prochaine ouverture."
            >
              <RefreshCw className="h-4 w-4" />
              Nouveau code
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function AutoAddOption({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  const [saving, setSaving] = useState(false)
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
      <Checkbox
        className="mt-0.5"
        checked={enabled}
        disabled={saving}
        onCheckedChange={async (value) => {
          setSaving(true)
          await fetch('/api/doctolib/status', {
            method: 'POST',
            headers: { ...APP_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({ autoAdd: value === true }),
          }).catch(() => null)
          setSaving(false)
          onChange()
        }}
      />
      <span>
        <span className="font-medium">Ajouter automatiquement les patients reconnus à Ma journée</span>
        <span className="block text-[13px] text-muted-foreground">
          Même nom, même prénom et même date de naissance qu’un dossier. Les autres rendez-vous restent à valider.
        </span>
      </span>
    </label>
  )
}

export function DoctolibSetupCard({ variant }: { variant: 'day-plan' | 'settings' }) {
  const { status, reload } = useDoctolibStatus(true)
  const storeUrl = useDoctolibStoreUrl()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (variant !== 'day-plan') return
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1')
    } catch {
      // Stockage indisponible : on affiche l'encart.
    }
  }, [variant])

  const setDismissedPersist = (value: boolean) => {
    setDismissed(value)
    try {
      if (value) localStorage.setItem(DISMISS_KEY, '1')
      else localStorage.removeItem(DISMISS_KEY)
    } catch {
      // Sans stockage, le choix vaut pour cette page seulement.
    }
  }

  if (!status) return null
  const connected = !!status.seen
  const hasSent = !!status.lastSync || !!status.lastImport
  const syncedAt = status.lastSync?.at ?? status.lastImport?.at ?? null

  // Ma journée, extension déjà en service : un simple rappel.
  if (variant === 'day-plan' && (hasSent || dismissed)) {
    return (
      <div className="flex max-w-2xl flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-dashed border-border bg-card px-4 py-3 text-sm">
        <CalendarArrowDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="min-w-0 flex-1 basis-64 text-muted-foreground">
          {hasSent && syncedAt ? (
            <>
              Agenda Doctolib synchronisé {ago(syncedAt)}.{' '}
              {status.autoAdd ? 'Les patients reconnus s’ajoutent seuls.' : 'Les rendez-vous à valider s’affichent ici.'}
            </>
          ) : (
            <><span className="font-medium text-foreground">Importer depuis Doctolib.</span> Vos rendez-vous du jour, envoyés ici en un clic.</>
          )}
        </p>
        {hasSent ? (
          <Button variant="ghost" size="sm" className="gap-1.5" asChild>
            <a href={DOCTOLIB_URL} target="_blank" rel="noreferrer">
              Ouvrir Doctolib
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setDismissedPersist(false)}>
            Mettre en place
          </Button>
        )}
      </div>
    )
  }

  return (
    <section
      className={cn('rounded-xl border bg-card', variant === 'day-plan' ? 'max-w-2xl border-primary/30' : 'border-border')}
      aria-labelledby="doctolib-setup-title"
    >
      <div className="flex flex-wrap items-start gap-3 card-head border-b px-5 py-4">
        <CalendarArrowDown className="mt-0.5 h-5 w-5 shrink-0 text-accent-foreground" />
        <div className="min-w-0 flex-1">
          <h2 id="doctolib-setup-title" className="text-base font-semibold">
            Importer vos rendez-vous Doctolib
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Votre agenda Doctolib ouvert dans Chrome, la semaine se synchronise toute seule avec Ma journée. Les données restent
            sur ce poste.
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
            connected ? 'bg-success-soft text-success' : 'bg-muted text-muted-foreground'
          )}
          title={status.seen ? `Dernier contact ${ago(status.seen.at)}` : undefined}
        >
          {connected ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {connected ? 'Extension connectée' : 'En attente de l’extension'}
        </span>
        {variant === 'day-plan' && (
          <Button
            variant="ghost"
            size="icon"
            className="-mr-2 -mt-1 h-8 w-8 text-muted-foreground"
            onClick={() => setDismissedPersist(true)}
            aria-label="Plus tard"
            title="Plus tard (toujours disponible dans Réglages, Doctolib)"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ol className="space-y-4 px-5 py-4">
        <Step index={1} done={connected} active={!connected} title="Installez l’extension dans Google Chrome">
          {storeUrl ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" className="gap-1.5" asChild>
                <a href={storeUrl} target="_blank" rel="noreferrer">
                  Installer l’extension
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
              <p className="text-[13px] text-muted-foreground">
                Laissez Osteoflow ouvert : l’extension s’y connecte toute seule, cet encart se met à jour.
              </p>
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              Version de test : dans Chrome, ouvrez <code className="rounded bg-muted px-1">chrome://extensions</code>, activez
              le mode développeur, puis « Charger l’extension non empaquetée » avec le dossier{' '}
              <code className="rounded bg-muted px-1">doctolib-extension</code>. Laissez Osteoflow ouvert : l’extension s’y
              connecte toute seule.
            </p>
          )}
        </Step>
        <Step
          index={2}
          done={hasSent}
          active={connected && !hasSent}
          title="Ouvrez votre agenda Doctolib dans Chrome"
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" variant="outline" className="gap-1.5" asChild>
              <a href={DOCTOLIB_URL} target="_blank" rel="noreferrer">
                Ouvrir Doctolib
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
            <p className="text-[13px] text-muted-foreground">
              La semaine se synchronise à l’ouverture, puis toutes les 10 minutes. Agenda déjà ouvert : rechargez la page (F5).
            </p>
          </div>
        </Step>
        <Step
          index={3}
          done={false}
          active={hasSent}
          title={status.autoAdd ? 'Les patients reconnus arrivent seuls dans Ma journée' : 'Validez les patients dans Ma journée'}
        >
          {syncedAt && (
            <p className="text-[13px] text-muted-foreground">
              Dernière synchronisation {ago(syncedAt)}
              {status.lastSync ? ` : ${status.lastSync.received} rendez-vous` : ''}
              {status.lastSync && status.lastSync.toReview > 0 ? `, ${status.lastSync.toReview} à vérifier dans Ma journée` : ''}.
            </p>
          )}
        </Step>
      </ol>

      {(variant === 'settings' || connected) && (
        <div className="border-t border-border px-5 py-4">
          <AutoAddOption enabled={status.autoAdd} onChange={reload} />
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3 border-t border-border px-5 py-3">
        <ManualPairing />
        <a href={TUTORIALS.doctolib} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent-foreground hover:underline">
          Voir le tutoriel pas à pas
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </section>
  )
}
