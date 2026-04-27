'use client'

import type { BodyMarker, BodyPath, MarkerShape, MarkerType } from '@/types/database'
import { painColor } from '@/lib/consultation-annotations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Trash2, Circle, X, Zap, Star, Triangle } from 'lucide-react'

const MARKER_TYPES: MarkerType[] = [
  'Douleur',
  'Tension',
  'Restriction',
  'Trigger point',
  'Inflammation',
  'Paresthésie',
]

const SHAPE_OPTIONS: Array<{ value: MarkerShape; icon: typeof Circle; label: string }> = [
  { value: 'dot', icon: Circle, label: 'Point' },
  { value: 'cross', icon: X, label: 'Croix' },
  { value: 'bolt', icon: Zap, label: 'Éclair' },
  { value: 'star', icon: Star, label: 'Étoile' },
  { value: 'triangle', icon: Triangle, label: 'Triangle' },
]

interface MarkerEditorProps {
  marker: BodyMarker
  onChange: (patch: Partial<BodyMarker>) => void
  onDelete: () => void
}

export function MarkerEditor({ marker, onChange, onDelete }: MarkerEditorProps) {
  const color = painColor(marker.eva)

  return (
    <div className="space-y-4 border-t p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Étiquette</Label>
          <Input
            value={marker.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Ex: Lombaires L4-L5, irradiation..."
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            EVA <span className="font-mono" style={{ color }}>{marker.eva}/10</span>
          </Label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={marker.eva}
              onChange={(e) => onChange({ eva: Number(e.target.value) })}
              className="h-2 flex-1 cursor-pointer appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-solid [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-solid [&::-moz-range-thumb]:bg-white"
              style={{
                background: 'linear-gradient(90deg, hsl(152 60% 50%) 0%, hsl(90 60% 50%) 25%, hsl(45 95% 55%) 50%, hsl(25 95% 55%) 75%, hsl(0 80% 58%) 100%)',
                ['--thumb-border-color' as string]: color,
              }}
              onInput={(e) => {
                // Update thumb color via CSS var trick not supported on native thumb; keep for future
                void e
              }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Type</Label>
        <div className="flex flex-wrap gap-1.5">
          {MARKER_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange({ type: t })}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                marker.type === t
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:border-primary/60 hover:text-primary'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Forme</Label>
        <div className="flex flex-wrap gap-1.5">
          {SHAPE_OPTIONS.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ shape: value })}
              title={label}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ${
                marker.shape === value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background hover:border-primary/60'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Note</Label>
        <Textarea
          value={marker.note ?? ''}
          onChange={(e) => onChange({ note: e.target.value })}
          placeholder="Détails sur cette zone (irradiation, facteurs déclenchants...)"
          rows={2}
          className="resize-none"
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Supprimer cette zone
        </Button>
        <span className="text-[11px] text-muted-foreground">
          Vue <span className="font-mono">{marker.view === 'front' ? 'FACE' : 'DOS'}</span>
        </span>
      </div>
    </div>
  )
}

interface PathEditorProps {
  path: BodyPath
  onChange: (patch: Partial<BodyPath>) => void
  onDelete: () => void
}

export function PathEditor({ path, onChange, onDelete }: PathEditorProps) {
  return (
    <div className="space-y-4 border-t p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {path.kind === 'free' ? 'Tracé libre' : 'Trajectoire / irradiation'}
          </Label>
          <Input
            value={path.label ?? ''}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Ex: Irradiation sciatique, zone de tension..."
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Couleur</Label>
          <div className="flex flex-wrap gap-1.5">
            {['hsl(0 80% 52%)', 'hsl(25 95% 48%)', 'hsl(40 95% 44%)', 'hsl(221 83% 53%)', 'hsl(262 72% 55%)'].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange({ color: c })}
                className={`h-7 w-7 rounded-full border-2 transition ${
                  (path.color ?? 'hsl(0 80% 52%)') === c ? 'border-foreground scale-110' : 'border-transparent'
                }`}
                style={{ background: c }}
                aria-label="Couleur"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Supprimer ce tracé
        </Button>
        <span className="text-[11px] text-muted-foreground">
          Vue <span className="font-mono">{path.view === 'front' ? 'FACE' : 'DOS'}</span>
        </span>
      </div>
    </div>
  )
}
