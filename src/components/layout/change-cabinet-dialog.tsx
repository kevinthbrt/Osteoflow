'use client'

import { useEffect, useState, useCallback } from 'react'
import { Building2, Check, Plus, Loader2, ArrowRightLeft, Share2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

interface Cabinet {
  id: string
  user_id: string
  first_name: string
  last_name: string
  practice_name: string | null
  is_active: boolean
}

type Cat = 'patients' | 'consultations' | 'compta'

// Catégories réellement cloisonnables (objectifs & stats suivent ces choix).
const SHARE_OPTIONS: { key: Cat; label: string; needs?: Cat }[] = [
  { key: 'patients', label: 'Patients' },
  { key: 'consultations', label: 'Consultations', needs: 'patients' },
  { key: 'compta', label: 'Comptabilité', needs: 'consultations' },
]

export function ChangeCabinetDialog() {
  const [open, setOpen] = useState(false)
  const [cabinets, setCabinets] = useState<Cabinet[]>([])
  const [shared, setShared] = useState<Cat[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cabRes, shareRes] = await Promise.all([
        fetch('/api/cabinets'),
        fetch('/api/cabinets/sharing'),
      ])
      if (cabRes.ok) setCabinets((await cabRes.json()).cabinets || [])
      if (shareRes.ok) {
        const all: string[] = (await shareRes.json()).shared || []
        setShared(all.filter((c): c is Cat => ['patients', 'consultations', 'compta'].includes(c)))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const openHandler = () => { setShowCreate(false); setNewName(''); setOpen(true); load() }
    window.addEventListener('open-cabinet-dialog', openHandler)
    return () => window.removeEventListener('open-cabinet-dialog', openHandler)
  }, [load])

  const handleSwitch = async (userId: string) => {
    setSwitching(userId)
    try {
      const res = await fetch('/api/cabinets/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })
      if (!res.ok) throw new Error()
      // Recharge complètement l'app sur le cabinet choisi.
      window.location.href = '/dashboard'
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de changer de cabinet.' })
      setSwitching(null)
    }
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/cabinets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (!res.ok) throw new Error()
      setCabinets((await res.json()).cabinets || [])
      setNewName('')
      setShowCreate(false)
      toast({ title: 'Cabinet créé', description: 'Vous pouvez maintenant basculer dessus.' })
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de créer le cabinet.' })
    } finally {
      setCreating(false)
    }
  }

  // Applique les dépendances (consultations⇒patients, compta⇒consultations).
  const toggleShare = async (key: Cat, checked: boolean) => {
    const set = new Set(shared)
    if (checked) {
      set.add(key)
      if (key === 'compta') set.add('consultations')
      if (key === 'compta' || key === 'consultations') set.add('patients')
    } else {
      set.delete(key)
      if (key === 'patients') { set.delete('consultations'); set.delete('compta') }
      if (key === 'consultations') set.delete('compta')
    }
    const next = (['patients', 'consultations', 'compta'] as Cat[]).filter((c) => set.has(c))
    setShared(next)
    try {
      await fetch('/api/cabinets/sharing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shared: next }),
      })
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Partage non enregistré.' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-full bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle className="text-lg">Changer de cabinet</DialogTitle>
          </div>
          <DialogDescription className="text-sm">
            Basculez entre vos cabinets ou créez-en un nouveau. Chaque cabinet a ses propres
            coordonnées et, par défaut, ses propres données.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="space-y-2">
              {cabinets.map((c) => (
                <div
                  key={c.user_id}
                  className={`flex items-center justify-between gap-2 rounded-lg border p-3 ${c.is_active ? 'border-primary/40 bg-primary/5' : ''}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.practice_name || `${c.first_name} ${c.last_name}`}</p>
                    {c.is_active && <p className="text-xs text-primary">Cabinet actif</p>}
                  </div>
                  {c.is_active ? (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <Button size="sm" variant="outline" disabled={!!switching} onClick={() => handleSwitch(c.user_id)} className="gap-1.5 shrink-0">
                      {switching === c.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="h-3.5 w-3.5" />}
                      Basculer
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {showCreate ? (
              <div className="space-y-2 rounded-lg border p-3">
                <Label htmlFor="cabinet-name" className="text-sm">Nom du nouveau cabinet</Label>
                <Input id="cabinet-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex. Cabinet Lyon" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreate} disabled={creating || !newName.trim()} className="gap-1.5">
                    {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Créer
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Annuler</Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowCreate(true)} className="gap-1.5 w-full">
                <Plus className="h-4 w-4" />
                Ajouter un cabinet
              </Button>
            )}

            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Share2 className="h-4 w-4 text-primary" />
                Partage entre cabinets
              </p>
              <p className="text-xs text-muted-foreground">
                Cochez les données mises en commun entre tous vos cabinets. Non coché = chaque
                cabinet garde ses propres données.
              </p>
              <div className="space-y-1.5 pt-1">
                {SHARE_OPTIONS.map((opt) => {
                  const checked = shared.includes(opt.key)
                  const blocked = !!opt.needs && !shared.includes(opt.needs) && !checked
                  return (
                    <label key={opt.key} className={`flex items-center gap-2 text-sm ${blocked ? 'opacity-50' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={blocked}
                        onChange={(e) => toggleShare(opt.key, e.target.checked)}
                        className="h-4 w-4 rounded border-input"
                      />
                      <span>{opt.label}</span>
                      {opt.needs && (
                        <span className="text-[10px] text-muted-foreground">(nécessite {opt.needs})</span>
                      )}
                    </label>
                  )
                })}
              </div>
              <p className="text-[11px] text-muted-foreground pt-1">
                Les objectifs et statistiques suivent automatiquement le partage de la
                comptabilité et des consultations.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
