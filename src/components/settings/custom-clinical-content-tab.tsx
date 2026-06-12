'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/db/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Trash2, Loader2, Stethoscope, Activity } from 'lucide-react'

interface CustomClinicalContent {
  id: string
  content_type: 'test' | 'technique'
  name: string
  description: string | null
  region: string | null
  sort_order: number
}

interface FormState {
  content_type: 'test' | 'technique'
  name: string
  description: string
  region: string
}

const emptyForm: FormState = {
  content_type: 'technique',
  name: '',
  description: '',
  region: '',
}

export function CustomClinicalContentTab({ practitionerId }: { practitionerId: string }) {
  const db = createClient()
  const { toast } = useToast()
  const [items, setItems] = useState<CustomClinicalContent[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await db
      .from('custom_clinical_content')
      .select('*')
      .eq('practitioner_id', practitionerId)
      .order('content_type', { ascending: true })
      .order('use_count', { ascending: false })
      .order('name', { ascending: true })
    setItems(data || [])
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practitionerId])

  useEffect(() => { load() }, [load])

  const openAdd = (type: 'test' | 'technique') => {
    setEditingId(null)
    setForm({ ...emptyForm, content_type: type })
    setDialogOpen(true)
  }

  const openEdit = (item: CustomClinicalContent) => {
    setEditingId(item.id)
    setForm({
      content_type: item.content_type,
      name: item.name,
      description: item.description || '',
      region: item.region || '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const payload = {
        practitioner_id: practitionerId,
        content_type: form.content_type,
        name: form.name.trim(),
        description: form.description.trim() || null,
        region: form.region.trim() || null,
      }
      if (editingId) {
        const { error } = await db
          .from('custom_clinical_content')
          .update(payload)
          .eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await db
          .from('custom_clinical_content')
          .insert(payload)
        if (error) throw error
      }
      setDialogOpen(false)
      await load()
      toast({ variant: 'success', title: editingId ? 'Modifié' : 'Ajouté', description: form.name })
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de sauvegarder' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (item: CustomClinicalContent) => {
    if (!confirm(`Supprimer "${item.name}" ?`)) return
    const { error } = await db
      .from('custom_clinical_content')
      .delete()
      .eq('id', item.id)
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de supprimer' })
    } else {
      await load()
      toast({ variant: 'success', title: 'Supprimé' })
    }
  }

  const tests = items.filter(i => i.content_type === 'test')
  const techniques = items.filter(i => i.content_type === 'technique')

  const Section = ({
    title,
    icon: Icon,
    entries,
    type,
    description,
    mention,
  }: {
    title: string
    icon: typeof Stethoscope
    entries: CustomClinicalContent[]
    type: 'test' | 'technique'
    description: string
    mention: string
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <CardDescription className="mt-1">{description}</CardDescription>
          <p className="text-xs text-muted-foreground mt-1">
            Utilisez <code className="bg-muted px-1 rounded">{mention}</code> dans l'examen clinique pour y accéder
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" className="shrink-0 mt-0.5" onClick={() => openAdd(type)}>
          <Plus className="h-4 w-4 mr-1" />
          Ajouter
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement...
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun élément. Cliquez sur Ajouter.</p>
        ) : (
          <div className="space-y-2">
            {entries.map(item => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-2 rounded-lg border px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  )}
                  {item.region && (
                    <Badge variant="secondary" className="text-[10px] mt-1">{item.region}</Badge>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(item)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <Section
        title="Mes techniques"
        icon={Activity}
        entries={techniques}
        type="technique"
        description="Vos techniques personnelles"
        mention="@tech<région>"
      />
      <Section
        title="Mes tests personnalisés"
        icon={Stethoscope}
        entries={tests}
        type="test"
        description="Tests ortho supplémentaires non présents dans la base OsteoUpgrade"
        mention="@test"
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier' : 'Ajouter'} un élément</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.content_type}
                onValueChange={(v) => setForm(p => ({ ...p, content_type: v as 'test' | 'technique' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technique">Technique</SelectItem>
                  <SelectItem value="test">Test personnalisé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-name">Nom *</Label>
              <Input
                id="cc-name"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="ex: HVLA dorsale D6-D7"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-region">Région</Label>
              <Input
                id="cc-region"
                value={form.region}
                onChange={e => setForm(p => ({ ...p, region: e.target.value }))}
                placeholder="ex: Colonne dorsale"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-desc">Description</Label>
              <Textarea
                id="cc-desc"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Description optionnelle..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
