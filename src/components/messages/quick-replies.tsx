'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, Plus, Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

interface QuickReply {
  id: string
  name: string
  content: string
  category: string | null
  use_count: number
}

interface QuickRepliesProps {
  onSelect: (content: string) => void
  onClose: () => void
}

// Default templates
const defaultTemplates = [
  {
    name: 'Suivi J+7',
    content:
      'Bonjour,\n\nJe prends de vos nouvelles suite à notre dernière consultation. Comment vous sentez-vous ? Les douleurs ont-elles diminué ?\n\nN\'hésitez pas à me contacter si vous avez des questions.\n\nCordialement',
    category: 'Suivi',
  },
  {
    name: 'Rappel RDV',
    content:
      'Bonjour,\n\nJe vous rappelle votre prochain rendez-vous prévu. Merci de me confirmer votre présence.\n\nCordialement',
    category: 'RDV',
  },
  {
    name: 'Conseils posturaux',
    content:
      'Bonjour,\n\nSuite à notre consultation, voici quelques conseils :\n- Faites des pauses régulières\n- Étirez-vous 5 minutes le matin\n- Gardez une bonne posture au travail\n\nN\'hésitez pas si vous avez des questions.\n\nCordialement',
    category: 'Conseils',
  },
  {
    name: 'Remerciement',
    content:
      'Bonjour,\n\nMerci de votre confiance. Je reste à votre disposition pour tout complément d\'information.\n\nCordialement',
    category: 'Général',
  },
]

export function QuickReplies({ onSelect, onClose }: QuickRepliesProps) {
  const [templates, setTemplates] = useState<QuickReply[]>([])
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newTemplate, setNewTemplate] = useState({ name: '', content: '', category: '' })
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .order('use_count', { ascending: false })

      if (error) throw error
      setTemplates(data as QuickReply[])
    } catch (error) {
      console.error('Error fetching templates:', error)
      // Use default templates if fetch fails
      setTemplates([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelect = async (template: QuickReply | typeof defaultTemplates[0]) => {
    onSelect(template.content)

    // Increment use count if it's a saved template
    if ('id' in template) {
      await supabase
        .from('message_templates')
        .update({ use_count: template.use_count + 1 })
        .eq('id', template.id)
    }
  }

  const handleAddTemplate = async () => {
    if (!newTemplate.name.trim() || !newTemplate.content.trim()) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Nom et contenu sont requis',
      })
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non authentifié')

      const { data: practitioner } = await supabase
        .from('practitioners')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!practitioner) throw new Error('Praticien non trouvé')

      const { error } = await supabase.from('message_templates').insert({
        practitioner_id: practitioner.id,
        name: newTemplate.name.trim(),
        content: newTemplate.content.trim(),
        category: newTemplate.category.trim() || null,
      })

      if (error) throw error

      toast({
        title: 'Modèle ajouté',
        description: 'Votre réponse rapide a été enregistrée',
      })

      setNewTemplate({ name: '', content: '', category: '' })
      setShowAddDialog(false)
      fetchTemplates()
    } catch (error) {
      console.error('Error adding template:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: "Impossible d'ajouter le modèle",
      })
    }
  }

  const allTemplates = [
    ...templates,
    ...defaultTemplates.filter(
      (dt) => !templates.some((t) => t.name === dt.name)
    ),
  ]

  const categories = [...new Set(allTemplates.map((t) => t.category).filter(Boolean))]

  return (
    <div className="mb-3 p-3 bg-muted/50 rounded-lg border animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" />
          Réponses rapides
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAddDialog(true)}
            className="h-7 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            Ajouter
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {categories.map((cat) => (
            <Badge key={cat} variant="outline" className="text-xs">
              {cat}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : (
          allTemplates.slice(0, 6).map((template, index) => (
            <Button
              key={'id' in template ? template.id : index}
              variant="outline"
              size="sm"
              onClick={() => handleSelect(template)}
              className="h-auto py-1.5 text-xs whitespace-normal text-left"
            >
              {template.name}
            </Button>
          ))
        )}
      </div>

      {/* Add template dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une réponse rapide</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input
                placeholder="Ex: Suivi hebdomadaire"
                value={newTemplate.name}
                onChange={(e) =>
                  setNewTemplate({ ...newTemplate, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Catégorie (optionnel)</Label>
              <Input
                placeholder="Ex: Suivi, RDV, Conseils"
                value={newTemplate.category}
                onChange={(e) =>
                  setNewTemplate({ ...newTemplate, category: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Contenu</Label>
              <Textarea
                placeholder="Votre message type..."
                rows={6}
                value={newTemplate.content}
                onChange={(e) =>
                  setNewTemplate({ ...newTemplate, content: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddTemplate}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
