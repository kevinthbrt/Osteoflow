'use client'

import { useState } from 'react'
import type { ConsultationAnnotations, BodyView } from '@/types/database'
import { BodyDiagram } from './body-diagram'
import { painColor } from '@/lib/consultation-annotations'

interface ConsultationAnnotationsViewProps {
  annotations: ConsultationAnnotations
}

export function ConsultationAnnotationsView({ annotations }: ConsultationAnnotationsViewProps) {
  const hasFront = annotations.markers.some((m) => m.view === 'front') || annotations.paths.some((p) => p.view === 'front')
  const hasBack = annotations.markers.some((m) => m.view === 'back') || annotations.paths.some((p) => p.view === 'back')
  const initial: BodyView = hasBack ? 'back' : hasFront ? 'front' : 'back'
  const [view, setView] = useState<BodyView>(initial)
  const noop = () => {}

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-md border p-0.5">
          <button
            type="button"
            onClick={() => setView('front')}
            className={`rounded px-2.5 py-1 text-xs font-medium ${view === 'front' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Face
            {hasFront && <span className="ml-1 text-[10px] opacity-70">●</span>}
          </button>
          <button
            type="button"
            onClick={() => setView('back')}
            className={`rounded px-2.5 py-1 text-xs font-medium ${view === 'back' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Dos
            {hasBack && <span className="ml-1 text-[10px] opacity-70">●</span>}
          </button>
        </div>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {annotations.markers.length} zone{annotations.markers.length > 1 ? 's' : ''} · {annotations.paths.length} tracé{annotations.paths.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <BodyDiagram
          view={view}
          markers={annotations.markers}
          paths={annotations.paths}
          selectedMarkerId={null}
          selectedPathId={null}
          tool="select"
          markerShape="dot"
          onAddMarker={noop}
          onSelectMarker={noop}
          onAddPath={noop}
          onSelectPath={noop}
        />
      </div>

      {annotations.markers.length > 0 && (
        <div className="space-y-1.5">
          {annotations.markers.map((m) => (
            <div key={m.id} className="flex items-start gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs">
              <span
                className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-white"
                style={{ background: painColor(m.eva), boxShadow: `0 0 0 1px ${painColor(m.eva)}` }}
              />
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {m.label || <span className="text-muted-foreground italic">sans étiquette</span>}{' '}
                  <span className="font-mono text-muted-foreground">· {m.eva}/10 · {m.type}</span>
                </div>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">{m.view === 'front' ? 'FACE' : 'DOS'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
