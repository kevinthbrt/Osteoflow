'use client'

import { useCallback, useRef, useState } from 'react'
import { MousePointerClick, Circle, Hexagon, Route, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { BodySilhouette } from '@/components/consultations/body-silhouette'
import { PainPointCard } from '@/components/consultations/pain-point-card'
import type { BodyView, PainCoord, PainPoint, PainPointKind } from '@/types/pain-points'
import type { Hypothesis } from '@/lib/hypotheses'

interface BodyChartProps {
  points: PainPoint[]
  onChange?: (points: PainPoint[]) => void
  readOnly?: boolean
  availableHypotheses?: Hypothesis[]
}

const centroid = (coords: PainCoord[]): PainCoord => {
  if (coords.length === 1) return coords[0]
  const n = coords.length
  const sum = coords.reduce((acc, c) => ({ x: acc.x + c.x, y: acc.y + c.y }), { x: 0, y: 0 })
  return { x: sum.x / n, y: sum.y / n }
}

const PLACEMENT_TOOLS: { mode: PainPointKind; label: string; icon: typeof Circle }[] = [
  { mode: 'point', label: 'Point', icon: Circle },
  { mode: 'zone', label: 'Zone', icon: Hexagon },
  { mode: 'path', label: 'Trajet', icon: Route },
]

export function BodyChart({ points, onChange, readOnly, availableHypotheses }: BodyChartProps) {
  const [activeView, setActiveView] = useState<BodyView>('front')
  const [placementMode, setPlacementMode] = useState<PainPointKind | null>(null)
  const [drawingCoords, setDrawingCoords] = useState<PainCoord[]>([])
  const draggingId = useRef<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const viewPoints = points.filter((p) => p.view === activeView)

  const coordsFromEvent = useCallback((e: { clientX: number; clientY: number }): PainCoord | null => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return null
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100))
    return { x, y }
  }, [])

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    if (readOnly || !placementMode) return
    const coord = coordsFromEvent(e)
    if (!coord) return

    if (placementMode === 'point') {
      const next: PainPoint = {
        id: crypto.randomUUID(),
        kind: 'point',
        view: activeView,
        coords: [coord],
        label: '',
        detail: '',
      }
      onChange?.([...points, next])
      setPlacementMode(null)
      return
    }

    setDrawingCoords((prev) => [...prev, coord])
  }, [readOnly, placementMode, coordsFromEvent, activeView, onChange, points])

  const finishDrawing = useCallback(() => {
    if (drawingCoords.length < 2 || !placementMode) { setDrawingCoords([]); setPlacementMode(null); return }
    const next: PainPoint = {
      id: crypto.randomUUID(),
      kind: placementMode,
      view: activeView,
      coords: drawingCoords,
      label: '',
      detail: '',
    }
    onChange?.([...points, next])
    setDrawingCoords([])
    setPlacementMode(null)
  }, [drawingCoords, placementMode, activeView, onChange, points])

  const cancelDrawing = useCallback(() => {
    setDrawingCoords([])
    setPlacementMode(null)
  }, [])

  // ── Déplacement d'un point simple (glisser pour préciser la position) ──
  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!draggingId.current) return
    const coord = coordsFromEvent(e)
    if (!coord) return
    onChange?.(points.map((p) => (p.id === draggingId.current ? { ...p, coords: [coord] } : p)))
  }, [coordsFromEvent, onChange, points])

  const stopDragging = useCallback(() => {
    draggingId.current = null
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', stopDragging)
  }, [handlePointerMove])

  const startDragging = useCallback((id: string) => {
    draggingId.current = id
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopDragging)
  }, [handlePointerMove, stopDragging])

  const updatePoint = (id: string, next: PainPoint) => {
    onChange?.(points.map((p) => (p.id === id ? next : p)))
  }
  const deletePoint = (id: string) => {
    onChange?.(points.filter((p) => p.id !== id))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
          {(['front', 'back'] as BodyView[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => { setActiveView(v); cancelDrawing() }}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                activeView === v ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {v === 'front' ? 'Face' : 'Dos'}
            </button>
          ))}
        </div>

        {!readOnly && (
          <div className="flex items-center gap-1.5">
            {!placementMode ? (
              PLACEMENT_TOOLS.map(({ mode, label, icon: Icon }) => (
                <Button key={mode} type="button" size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setPlacementMode(mode)}>
                  <Icon className="h-3 w-3" />
                  {label}
                </Button>
              ))
            ) : (
              <>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MousePointerClick className="h-3 w-3" />
                  {placementMode === 'point' ? 'Cliquez sur le corps' : `Cliquez pour tracer (${drawingCoords.length} pt${drawingCoords.length > 1 ? 's' : ''})`}
                </span>
                {placementMode !== 'point' && (
                  <Button type="button" size="sm" className="h-7 gap-1 text-xs" onClick={finishDrawing} disabled={drawingCoords.length < 2}>
                    <Check className="h-3 w-3" /> Terminer
                  </Button>
                )}
                <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={cancelDrawing}>
                  <X className="h-3 w-3" /> Annuler
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <div
        ref={containerRef}
        onClick={handleContainerClick}
        className={cn(
          'relative mx-auto w-full max-w-[220px] rounded-xl border bg-muted/20 select-none',
          placementMode && 'cursor-crosshair',
        )}
      >
        <BodySilhouette className="w-full h-auto" />

        {/* Tracé en cours (zone/trajet) */}
        {drawingCoords.length > 0 && (
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline
              points={drawingCoords.map((c) => `${c.x},${c.y}`).join(' ')}
              fill={placementMode === 'zone' ? 'rgba(244,63,94,0.15)' : 'none'}
              stroke="rgb(244,63,94)"
              strokeWidth={0.6}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}

        {/* Zones / trajets déjà placés */}
        <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          {viewPoints.filter((p) => p.kind !== 'point').map((p) => (
            <polyline
              key={p.id}
              points={p.coords.map((c) => `${c.x},${c.y}`).join(' ') + (p.kind === 'zone' ? ` ${p.coords[0].x},${p.coords[0].y}` : '')}
              fill={p.kind === 'zone' ? 'rgba(244,63,94,0.12)' : 'none'}
              stroke="rgb(244,63,94)"
              strokeWidth={0.6}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        {viewPoints.map((p) => {
          const c = centroid(p.coords)
          return (
            <PainPointCard
              key={p.id}
              point={p}
              x={c.x}
              y={c.y}
              readOnly={readOnly}
              onChange={(next) => updatePoint(p.id, next)}
              onDelete={() => deletePoint(p.id)}
              onDragStart={() => startDragging(p.id)}
              availableHypotheses={availableHypotheses}
            />
          )
        })}
      </div>
    </div>
  )
}
