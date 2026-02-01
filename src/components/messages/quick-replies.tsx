'use client'

import { Button } from '@/components/ui/button'
import { X, Palmtree, CalendarPlus } from 'lucide-react'

interface QuickRepliesProps {
  onSelect: (content: string) => void
  onClose: () => void
}

const templates = [
  {
    name: 'Fermeture / Vacances',
    icon: Palmtree,
    content:
      'Je vous informe que le cabinet sera fermé du [date début] au [date fin] inclus.\n\nJe reste disponible par email pour toute question urgente. Les consultations reprendront normalement dès le [date reprise].\n\nJe vous souhaite une excellente période et vous retrouve avec plaisir à mon retour.',
  },
  {
    name: 'Invitation à consulter',
    icon: CalendarPlus,
    content:
      'Cela fait un moment que nous ne nous sommes pas vus. Comment allez-vous ?\n\nUn suivi régulier en ostéopathie permet de maintenir un bon équilibre corporel et de prévenir l\'apparition de tensions ou de douleurs.\n\nN\'hésitez pas à prendre rendez-vous si vous le souhaitez. Je reste à votre disposition.',
  },
]

export function QuickReplies({ onSelect, onClose }: QuickRepliesProps) {
  return (
    <div className="mb-3 p-3 bg-muted/50 rounded-lg border animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium">Modèles de message</p>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {templates.map((template) => (
          <button
            key={template.name}
            onClick={() => onSelect(template.content)}
            className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <template.icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{template.name}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {template.content.split('\n')[0]}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
