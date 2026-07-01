'use client'

import { useState } from 'react'
import { Stethoscope, Syringe, Brain, Trash2, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { PainPoint } from '@/types/pain-points'
import type { Hypothesis } from '@/lib/hypotheses'

interface PainPointCardProps {
  point: PainPoint
  /** Position centrale du marqueur (%) — pour "zone"/"path" c'est le centroïde. */
  x: number
  y: number
  readOnly?: boolean
  onChange?: (next: PainPoint) => void
  onDelete?: () => void
  onDragStart?: () => void
  /** Hypothèses disponibles (déjà générées pour la consultation) à lier au point. */
  availableHypotheses?: Hypothesis[]
}

const KIND_LABEL: Record<PainPoint['kind'], string> = {
  point: 'Point',
  zone: 'Zone',
  path: 'Trajet',
}

/** Marqueur sur la bodychart : survol = carte élargie en aperçu, clic = édition complète. */
export function PainPointCard({ point, x, y, readOnly, onChange, onDelete, onDragStart, availableHypotheses }: PainPointCardProps) {
  const [hovered, setHovered] = useState(false)
  const [open, setOpen] = useState(false)

  const set = (patch: Partial<PainPoint>) => onChange?.({ ...point, ...patch })

  return (
    <>
      <div
        className="absolute z-10 -translate-x-1/2 -translate-y-1/2 group/marker"
        style={{ left: `${x}%`, top: `${y}%` }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          onPointerDown={(e) => { if (!readOnly && point.kind === 'point') { e.stopPropagation(); onDragStart?.() } }}
          className={cn(
            'h-4 w-4 rounded-full border-2 border-white shadow-md bg-rose-500 hover:bg-rose-600 transition-transform',
            hovered && 'scale-125',
            !readOnly && point.kind === 'point' && 'cursor-grab active:cursor-grabbing',
          )}
          aria-label={point.label || 'Point douloureux'}
        />

        {/* Carte d'aperçu — s'élargit au survol */}
        <div
          className={cn(
            'pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 rounded-lg border bg-popover text-popover-foreground shadow-lg transition-all duration-150 origin-top overflow-hidden',
            hovered ? 'opacity-100 scale-100 w-56 p-3' : 'opacity-0 scale-95 w-0 p-0',
          )}
        >
          <p className="text-xs font-semibold flex items-center gap-1.5">
            <span className="inline-block rounded bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
              {KIND_LABEL[point.kind]}
            </span>
            {point.label || 'Sans libellé'}
          </p>
          {point.detail && (
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-4">{point.detail}</p>
          )}
          {(point.examen_clinique || point.traitement) && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {point.examen_clinique && (
                <span className="inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                  <Stethoscope className="h-2.5 w-2.5" /> Examen
                </span>
              )}
              {point.traitement && (
                <span className="inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                  <Syringe className="h-2.5 w-2.5" /> Traitement
                </span>
              )}
            </div>
          )}
          <p className="mt-1.5 text-[10px] text-muted-foreground/70">Cliquer pour détailler</p>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="inline-block rounded bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                {KIND_LABEL[point.kind]}
              </span>
              {readOnly ? point.label || 'Point douloureux' : null}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Libellé / région</label>
              {readOnly ? (
                <p className="text-sm">{point.label || '—'}</p>
              ) : (
                <Input value={point.label} onChange={(e) => set({ label: e.target.value })} placeholder="Ex. Épaule droite" />
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <GripVertical className="h-3 w-3" /> Détail de la douleur
              </label>
              {readOnly ? (
                <p className="text-sm whitespace-pre-line">{point.detail || '—'}</p>
              ) : (
                <Textarea
                  value={point.detail}
                  onChange={(e) => set({ detail: e.target.value })}
                  placeholder="Type, intensité (EVA), irradiations, facteurs déclenchants…"
                  rows={3}
                />
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Stethoscope className="h-3 w-3" /> Examen clinique
              </label>
              {readOnly ? (
                <p className="text-sm whitespace-pre-line">{point.examen_clinique || '—'}</p>
              ) : (
                <Textarea
                  value={point.examen_clinique ?? ''}
                  onChange={(e) => set({ examen_clinique: e.target.value })}
                  placeholder="Tests réalisés, résultats…"
                  rows={2}
                />
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Syringe className="h-3 w-3" /> Traitement
              </label>
              {readOnly ? (
                <p className="text-sm whitespace-pre-line">{point.traitement || '—'}</p>
              ) : (
                <Textarea
                  value={point.traitement ?? ''}
                  onChange={(e) => set({ traitement: e.target.value })}
                  placeholder="Techniques réalisées / prévues…"
                  rows={2}
                />
              )}
            </div>

            {!!availableHypotheses?.length && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Brain className="h-3 w-3" /> Hypothèses diagnostiques liées
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {availableHypotheses.map((h) => {
                    const active = point.hypothesis_ids?.includes(h.id) ?? false
                    return (
                      <button
                        key={h.id}
                        type="button"
                        disabled={readOnly}
                        onClick={() => {
                          const ids = point.hypothesis_ids ?? []
                          set({ hypothesis_ids: active ? ids.filter((id) => id !== h.id) : [...ids, h.id] })
                        }}
                        className={cn(
                          'text-xs rounded-full px-2.5 py-1 border transition-colors',
                          active
                            ? 'bg-violet-600 text-white border-violet-600'
                            : 'bg-background text-muted-foreground border-border hover:bg-accent',
                        )}
                      >
                        {h.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {!readOnly && onDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive gap-1.5"
                onClick={() => { onDelete(); setOpen(false) }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer ce marqueur
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
