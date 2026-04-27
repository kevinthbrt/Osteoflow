'use client'

import { useRef, useState, useCallback } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { BodyMarker, BodyPath, BodyView, MarkerShape } from '@/types/database'
import {
  BODY_SVG_HEIGHT,
  BODY_SVG_WIDTH,
  painColor,
  regionsForView,
} from '@/lib/consultation-annotations'

export type BodyTool = 'marker' | 'pen' | 'trajectory' | 'select'

interface BodyDiagramProps {
  view: BodyView
  markers: BodyMarker[]
  paths: BodyPath[]
  selectedMarkerId: string | null
  selectedPathId: string | null
  tool: BodyTool
  markerShape: MarkerShape
  onAddMarker: (cx: number, cy: number, label: string) => void
  onSelectMarker: (id: string | null) => void
  onAddPath: (path: Omit<BodyPath, 'id'>) => void
  onSelectPath: (id: string | null) => void
}

function FrontSilhouette() {
  return (
    <g>
      <ellipse cx="200" cy="55" rx="38" ry="44" className="body-outline" />
      <path d="M 180 90 L 180 110 L 220 110 L 220 90" className="body-outline" />
      <path
        d="M 180 108 C 150 112, 120 120, 108 140 L 112 160 C 128 158, 140 160, 148 168 L 148 260 C 148 280, 152 300, 156 320 L 160 360 L 175 360 L 178 250 L 222 250 L 225 360 L 240 360 L 244 320 C 248 300, 252 280, 252 260 L 252 168 C 260 160, 272 158, 288 160 L 292 140 C 280 120, 250 112, 220 108 Z"
        className="body-outline"
      />
      <path
        d="M 108 140 L 92 200 L 88 260 L 96 320 L 92 360 L 108 360 L 118 320 L 122 260 L 128 210 L 132 160"
        className="body-outline"
      />
      <path
        d="M 292 140 L 308 200 L 312 260 L 304 320 L 308 360 L 292 360 L 282 320 L 278 260 L 272 210 L 268 160"
        className="body-outline"
      />
      <ellipse cx="100" cy="380" rx="12" ry="22" className="body-outline" />
      <ellipse cx="300" cy="380" rx="12" ry="22" className="body-outline" />
      <path
        d="M 158 360 L 152 430 L 150 520 L 145 610 L 155 670 L 172 670 L 178 600 L 182 500 L 184 430 L 182 360 Z"
        className="body-outline"
      />
      <path
        d="M 242 360 L 248 430 L 250 520 L 255 610 L 245 670 L 228 670 L 222 600 L 218 500 L 216 430 L 218 360 Z"
        className="body-outline"
      />
      <ellipse cx="160" cy="685" rx="14" ry="10" className="body-outline" />
      <ellipse cx="240" cy="685" rx="14" ry="10" className="body-outline" />

      <path d="M 200 110 L 200 250" className="body-detail" />
      <path d="M 148 170 C 170 180, 230 180, 252 170" className="body-detail" />
      <path d="M 155 230 C 180 240, 220 240, 245 230" className="body-detail" />
      <ellipse cx="175" cy="175" rx="10" ry="7" className="body-detail" />
      <ellipse cx="225" cy="175" rx="10" ry="7" className="body-detail" />
      <path d="M 168 280 C 185 288, 215 288, 232 280" className="body-detail" />
      <ellipse cx="167" cy="495" rx="16" ry="10" className="body-detail" />
      <ellipse cx="233" cy="495" rx="16" ry="10" className="body-detail" />
    </g>
  )
}

function BackSilhouette() {
  return (
    <g>
      <ellipse cx="200" cy="55" rx="38" ry="44" className="body-outline" />
      <path d="M 180 90 L 180 110 L 220 110 L 220 90" className="body-outline" />
      <path
        d="M 180 108 C 150 112, 120 120, 108 140 L 112 160 C 128 158, 140 160, 148 168 L 148 260 C 148 280, 152 300, 156 320 L 160 360 L 175 360 L 178 250 L 222 250 L 225 360 L 240 360 L 244 320 C 248 300, 252 280, 252 260 L 252 168 C 260 160, 272 158, 288 160 L 292 140 C 280 120, 250 112, 220 108 Z"
        className="body-outline"
      />
      <path
        d="M 108 140 L 92 200 L 88 260 L 96 320 L 92 360 L 108 360 L 118 320 L 122 260 L 128 210 L 132 160"
        className="body-outline"
      />
      <path
        d="M 292 140 L 308 200 L 312 260 L 304 320 L 308 360 L 292 360 L 282 320 L 278 260 L 272 210 L 268 160"
        className="body-outline"
      />
      <ellipse cx="100" cy="380" rx="12" ry="22" className="body-outline" />
      <ellipse cx="300" cy="380" rx="12" ry="22" className="body-outline" />
      <path
        d="M 158 360 L 152 430 L 150 520 L 145 610 L 155 670 L 172 670 L 178 600 L 182 500 L 184 430 L 182 360 Z"
        className="body-outline"
      />
      <path
        d="M 242 360 L 248 430 L 250 520 L 255 610 L 245 670 L 228 670 L 222 600 L 218 500 L 216 430 L 218 360 Z"
        className="body-outline"
      />
      <ellipse cx="160" cy="685" rx="14" ry="10" className="body-outline" />
      <ellipse cx="240" cy="685" rx="14" ry="10" className="body-outline" />

      <path d="M 200 108 L 200 360" className="body-detail" strokeDasharray="2,3" strokeWidth="1.2" />
      {Array.from({ length: 18 }).map((_, i) => (
        <line key={i} x1="193" y1={120 + i * 14} x2="207" y2={120 + i * 14} className="body-detail" />
      ))}
      <path d="M 155 150 C 145 180, 150 210, 175 220" className="body-detail" />
      <path d="M 245 150 C 255 180, 250 210, 225 220" className="body-detail" />
      <path d="M 200 365 C 190 380, 175 385, 165 380" className="body-detail" />
      <path d="M 200 365 C 210 380, 225 385, 235 380" className="body-detail" />
      <ellipse cx="167" cy="495" rx="14" ry="8" className="body-detail" />
      <ellipse cx="233" cy="495" rx="14" ry="8" className="body-detail" />
    </g>
  )
}


function pointsToPath(points: Array<{ x: number; y: number }>): string {
  if (!points.length) return ''
  const [first, ...rest] = points
  return `M ${first.x} ${first.y} ` + rest.map((p) => `L ${p.x} ${p.y}`).join(' ')
}

function pointsToSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return ''
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2
    const yc = (points[i].y + points[i + 1].y) / 2
    d += ` Q ${points[i].x} ${points[i].y} ${xc} ${yc}`
  }
  const last = points[points.length - 1]
  d += ` T ${last.x} ${last.y}`
  return d
}

function MarkerShapeSvg({ shape, color }: { shape: MarkerShape; color: string }) {
  if (shape === 'dot') {
    return <circle r={9} fill={color} stroke="white" strokeWidth={2.5} />
  }
  if (shape === 'cross') {
    return (
      <>
        <circle r={9} fill="white" stroke={color} strokeWidth={2} />
        <path d="M -4 -4 L 4 4 M 4 -4 L -4 4" stroke={color} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      </>
    )
  }
  if (shape === 'bolt') {
    return (
      <>
        <circle r={9} fill="white" stroke={color} strokeWidth={2} />
        <path d="M 2 -6 L -3 1 L 0 1 L -2 6 L 4 -1 L 1 -1 Z" fill={color} />
      </>
    )
  }
  if (shape === 'star') {
    const pts: Array<[number, number]> = []
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 9 : 3.5
      const a = (Math.PI * 2 * i) / 10 - Math.PI / 2
      pts.push([Math.cos(a) * r, Math.sin(a) * r])
    }
    return (
      <polygon
        points={pts.map((p) => p.join(',')).join(' ')}
        fill={color}
        stroke="white"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    )
  }
  return (
    <polygon
      points="0,-9 8,7 -8,7"
      fill={color}
      stroke="white"
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
  )
}

export function BodyDiagram({
  view,
  markers,
  paths,
  selectedMarkerId,
  selectedPathId,
  tool,
  markerShape,
  onAddMarker,
  onSelectMarker,
  onAddPath,
  onSelectPath,
}: BodyDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [drawingPoints, setDrawingPoints] = useState<Array<{ x: number; y: number }> | null>(null)
  const [trajectoryStart, setTrajectoryStart] = useState<{ x: number; y: number } | null>(null)
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null)

  const viewMarkers = markers.filter((m) => m.view === view)
  const viewPaths = paths.filter((p) => p.view === view)

  const getSvgPoint = useCallback(
    (e: { clientX: number; clientY: number }): { x: number; y: number } | null => {
      const svg = svgRef.current
      if (!svg) return null
      const pt = svg.createSVGPoint()
      pt.x = e.clientX
      pt.y = e.clientY
      const ctm = svg.getScreenCTM()
      if (!ctm) return null
      const loc = pt.matrixTransform(ctm.inverse())
      return { x: loc.x, y: loc.y }
    },
    [],
  )

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const pt = getSvgPoint(e)
    if (!pt) return
    if (tool === 'pen') {
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      setDrawingPoints([pt])
    } else if (tool === 'trajectory') {
      if (!trajectoryStart) {
        setTrajectoryStart(pt)
      } else {
        onAddPath({ view, kind: 'trajectory', points: [trajectoryStart, pt] })
        setTrajectoryStart(null)
      }
    } else if (tool === 'marker') {
      onAddMarker(pt.x, pt.y, '')
    } else if (tool === 'select') {
      // Click on empty area deselects
      onSelectMarker(null)
      onSelectPath(null)
    }
  }

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const pt = getSvgPoint(e)
    if (!pt) return
    if (tool === 'pen' && drawingPoints) {
      setDrawingPoints((prev) => {
        if (!prev || prev.length === 0) return [pt]
        const last = prev[prev.length - 1]
        const d = Math.hypot(pt.x - last.x, pt.y - last.y)
        // Skip points too close to the previous one — kills jitter
        if (d < 3.5) return prev
        return [...prev, pt]
      })
    } else if (tool === 'trajectory' && trajectoryStart) {
      setHoverPoint(pt)
    }
  }

  const handlePointerUp = () => {
    if (tool === 'pen' && drawingPoints && drawingPoints.length > 1) {
      onAddPath({ view, kind: 'free', points: drawingPoints })
    }
    setDrawingPoints(null)
  }

  const cancelTrajectory = () => {
    setTrajectoryStart(null)
    setHoverPoint(null)
  }

  const cursorClass =
    tool === 'pen' ? 'cursor-crosshair' : tool === 'trajectory' ? 'cursor-crosshair' : tool === 'marker' ? 'cursor-crosshair' : 'cursor-default'

  return (
    <div className="relative h-[560px] w-full overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgb(203_213_225/0.5)_1px,transparent_1px),linear-gradient(90deg,rgb(203_213_225/0.5)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_70%_90%_at_50%_50%,black_30%,transparent_75%)]" />

      <svg
        ref={svgRef}
        viewBox={`0 0 ${BODY_SVG_WIDTH} ${BODY_SVG_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className={`relative z-[1] mx-auto block h-full w-auto ${cursorClass}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={cancelTrajectory}
      >
        <style>{`
          .body-outline { fill: hsl(220 30% 96%); stroke: hsl(220 25% 70%); stroke-width: 1.2; }
          .body-detail { fill: none; stroke: hsl(220 25% 65%); stroke-width: 0.8; opacity: 0.5; }
          .body-region { fill: transparent; stroke: transparent; }
          .dark .body-outline { fill: hsl(220 20% 20%); stroke: hsl(220 15% 50%); }
          .dark .body-detail { stroke: hsl(220 15% 55%); }
        `}</style>

        {view === 'front' ? <FrontSilhouette /> : <BackSilhouette />}

        {/* Region hit circles (for tooltips only - click is global) */}
        {regionsForView(view).map((r) => (
          <circle key={r.id} cx={r.cx} cy={r.cy} r={r.r} className="body-region">
            <title>{r.label}</title>
          </circle>
        ))}

        {/* Saved paths */}
        {viewPaths.map((p) => {
          const isSelected = p.id === selectedPathId
          const color = p.color ?? 'hsl(0 80% 52%)'
          return (
            <g key={p.id} onClick={(e) => { e.stopPropagation(); onSelectPath(p.id) }} style={{ cursor: 'pointer' }}>
              {p.kind === 'trajectory' && p.points.length === 2 ? (
                <>
                  <line
                    x1={p.points[0].x}
                    y1={p.points[0].y}
                    x2={p.points[1].x}
                    y2={p.points[1].y}
                    stroke={color}
                    strokeWidth={isSelected ? 5 : 3.5}
                    strokeLinecap="round"
                    strokeDasharray="1 6"
                  />
                  <circle cx={p.points[0].x} cy={p.points[0].y} r={4} fill={color} />
                  <polygon
                    points={`${p.points[1].x},${p.points[1].y - 6} ${p.points[1].x - 5},${p.points[1].y + 4} ${p.points[1].x + 5},${p.points[1].y + 4}`}
                    fill={color}
                    transform={`rotate(${(Math.atan2(p.points[1].y - p.points[0].y, p.points[1].x - p.points[0].x) * 180) / Math.PI + 90} ${p.points[1].x} ${p.points[1].y})`}
                  />
                </>
              ) : (
                <path
                  d={pointsToSmoothPath(p.points)}
                  fill="none"
                  stroke={color}
                  strokeWidth={isSelected ? 4 : 2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </g>
          )
        })}

        {/* Path being drawn (free) */}
        {drawingPoints && drawingPoints.length > 1 && (
          <path
            d={pointsToSmoothPath(drawingPoints)}
            fill="none"
            stroke="hsl(0 80% 52%)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.85}
          />
        )}

        {/* Trajectory preview */}
        {trajectoryStart && hoverPoint && (
          <line
            x1={trajectoryStart.x}
            y1={trajectoryStart.y}
            x2={hoverPoint.x}
            y2={hoverPoint.y}
            stroke="hsl(0 80% 52%)"
            strokeWidth={3}
            strokeDasharray="1 6"
            strokeLinecap="round"
            opacity={0.6}
          />
        )}
        {trajectoryStart && (
          <circle cx={trajectoryStart.x} cy={trajectoryStart.y} r={4} fill="hsl(0 80% 52%)" />
        )}

        {/* Markers — rendered inside the SVG so coordinates are exact */}
        {viewMarkers.map((m) => {
          const color = painColor(m.eva)
          const selected = m.id === selectedMarkerId
          const labelText = `${m.eva}/10${m.label ? ` · ${m.label}` : ''}`
          return (
            <g
              key={m.id}
              transform={`translate(${m.cx} ${m.cy})`}
              style={{ cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); onSelectMarker(m.id) }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {selected && <circle r={14} fill="none" stroke={color} strokeWidth={2} opacity={0.7} />}
              <g style={{ transformOrigin: '0 0' }} transform={selected ? 'scale(1.18)' : 'scale(1)'}>
                <MarkerShapeSvg shape={m.shape} color={color} />
              </g>
              <text
                y={24}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill={color}
                stroke="white"
                strokeWidth={3}
                paintOrder="stroke"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {labelText}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[2] flex items-center gap-2 rounded-lg border border-border/50 bg-background/90 px-3 py-2 text-[10px] shadow-sm backdrop-blur">
        <span className="font-mono text-muted-foreground">EVA</span>
        <span className="font-mono">0</span>
        <span className="h-2 w-4 rounded" style={{ background: painColor(1) }} />
        <span className="h-2 w-4 rounded" style={{ background: painColor(3) }} />
        <span className="h-2 w-4 rounded" style={{ background: painColor(5) }} />
        <span className="h-2 w-4 rounded" style={{ background: painColor(7) }} />
        <span className="h-2 w-4 rounded" style={{ background: painColor(9) }} />
        <span className="font-mono">10</span>
      </div>

      {/* Drawing hint */}
      {tool === 'trajectory' && (
        <div className="pointer-events-none absolute top-3 left-1/2 z-[2] -translate-x-1/2 rounded-full border border-border/50 bg-background/95 px-3 py-1 text-[11px] shadow-sm backdrop-blur">
          {trajectoryStart ? 'Cliquez pour placer le point d’arrivée · double-clic pour annuler' : 'Cliquez le point de départ de l’irradiation'}
        </div>
      )}
      {tool === 'pen' && (
        <div className="pointer-events-none absolute top-3 left-1/2 z-[2] -translate-x-1/2 rounded-full border border-border/50 bg-background/95 px-3 py-1 text-[11px] shadow-sm backdrop-blur">
          Maintenez et glissez pour tracer
        </div>
      )}
      {tool === 'marker' && (
        <div className="pointer-events-none absolute top-3 left-1/2 z-[2] -translate-x-1/2 rounded-full border border-border/50 bg-background/95 px-3 py-1 text-[11px] shadow-sm backdrop-blur">
          Cliquez pour poser un marqueur <span className="opacity-60">({markerShape})</span>
        </div>
      )}
    </div>
  )
}
