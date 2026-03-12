'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, ChevronDown, ChevronUp, AlertCircle, Loader2, ExternalLink, BookOpen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

// ─── Types ──────────────────────────────────────────────────────────────────

type AnatomicalRegion =
  | 'cervical' | 'atm' | 'crane' | 'thoracique' | 'lombaire'
  | 'sacro-iliaque' | 'cotes' | 'epaule' | 'coude' | 'poignet'
  | 'hanche' | 'genou' | 'cheville' | 'pied'
  | 'neurologique' | 'vasculaire' | 'systemique'

export type BodySide = 'left' | 'right' | 'bilateral'

export interface BodyZoneEntry {
  region: AnatomicalRegion
  side: BodySide
  notes: string
}

interface OsteoupgradePathology {
  id: string
  name: string
  description: string | null
  region: string
  clinical_signs: string | null
  is_red_flag: boolean | null
  red_flag_reason: string | null
}

interface BodyDiagramAnamnesisProps {
  value: BodyZoneEntry[]
  onChange: (zones: BodyZoneEntry[]) => void
  disabled?: boolean
}

// ─── Constants ───────────────────────────────────────────────────────────────

const REGION_LABELS: Record<AnatomicalRegion, string> = {
  cervical: 'Cervical',
  atm: 'ATM',
  crane: 'Crâne',
  thoracique: 'Thoracique',
  lombaire: 'Lombaire',
  'sacro-iliaque': 'Sacro-iliaque',
  cotes: 'Côtes',
  epaule: 'Épaule',
  coude: 'Coude',
  poignet: 'Poignet/Main',
  hanche: 'Hanche',
  genou: 'Genou',
  cheville: 'Cheville',
  pied: 'Pied',
  neurologique: 'Neurologique',
  vasculaire: 'Vasculaire',
  systemique: 'Systémique',
}

const SIDE_LABELS: Record<BodySide, string> = {
  left: 'G',
  right: 'D',
  bilateral: '',
}

const SIDE_LABELS_FULL: Record<BodySide, string> = {
  left: 'gauche',
  right: 'droit',
  bilateral: '',
}

// Regions that have left/right laterality
const BILATERAL_REGIONS = new Set<AnatomicalRegion>([
  'atm', 'epaule', 'coude', 'poignet', 'hanche', 'genou', 'cheville', 'pied',
])

function getZoneKey(region: AnatomicalRegion, side: BodySide): string {
  return `${region}_${side}`
}

function getZoneLabel(region: AnatomicalRegion, side: BodySide): string {
  const base = REGION_LABELS[region]
  if (side === 'bilateral') return base
  return `${base} ${SIDE_LABELS_FULL[side]}`
}

// ─── SVG Body Paths ──────────────────────────────────────────────────────────
// ViewBox: "60 0 280 560"
// Patient's RIGHT = drawing's LEFT (x < 200)
// Patient's LEFT  = drawing's RIGHT (x > 200)

const BODY_SILHOUETTE = `
  M200,10
  Q230,10 230,35 Q230,60 215,65
  L218,85
  Q260,82 280,100 Q295,115 300,140
  L310,175
  Q315,195 305,210
  L315,240
  Q320,260 310,270 L305,275
  Q295,260 290,260
  L280,235
  Q275,210 270,195
  L255,160
  L250,230
  Q260,250 260,280
  L258,340
  Q260,360 255,390
  L252,430
  Q255,460 252,490
  Q255,510 260,530
  Q260,545 240,550
  Q220,545 218,535
  L215,510
  Q215,500 218,480
  L220,430
  Q222,400 220,370
  L215,310
  Q212,290 200,280
  Q188,290 185,310
  L180,370
  Q178,400 180,430
  L182,480
  Q185,500 185,510
  L182,535
  Q180,545 160,550
  Q140,545 140,530
  Q145,510 148,490
  Q145,460 148,430
  L145,390
  Q140,360 142,340
  L140,280
  Q140,250 150,230
  L145,160
  L130,195
  Q125,210 120,235
  L110,260
  Q105,260 95,275
  L90,270
  Q80,260 85,240
  L90,210
  Q85,195 90,175
  L100,140
  Q105,115 120,100
  Q140,82 182,85
  L185,65
  Q170,60 170,35 Q170,10 200,10Z
`

type PathEntry = {
  region: AnatomicalRegion
  side: BodySide
  path: string
}

// Front view paths — bilateral regions are split into right (patient's) and left
const FRONT_PATHS: PathEntry[] = [
  {
    region: 'crane', side: 'bilateral',
    path: 'M175,30 Q175,10 200,10 Q225,10 225,30 Q225,55 200,60 Q175,55 175,30Z',
  },
  // ATM — split L/R
  {
    region: 'atm', side: 'right',
    path: 'M172,38 Q165,38 165,45 Q165,52 172,52 Q175,52 175,45 Q175,38 172,38Z',
  },
  {
    region: 'atm', side: 'left',
    path: 'M228,38 Q235,38 235,45 Q235,52 228,52 Q225,52 225,45 Q225,38 228,38Z',
  },
  {
    region: 'cervical', side: 'bilateral',
    path: 'M188,60 L212,60 L215,85 L185,85Z',
  },
  // Épaule — split R/L
  {
    region: 'epaule', side: 'right',
    path: 'M140,88 Q130,85 125,95 Q120,108 130,115 L155,110 L155,88Z',
  },
  {
    region: 'epaule', side: 'left',
    path: 'M245,88 L260,88 Q270,85 275,95 Q280,108 270,115 L245,110Z',
  },
  {
    region: 'thoracique', side: 'bilateral',
    path: 'M155,88 L245,88 L245,140 L155,140Z',
  },
  {
    region: 'cotes', side: 'bilateral',
    path: 'M155,140 L245,140 L250,165 L150,165Z',
  },
  {
    region: 'lombaire', side: 'bilateral',
    path: 'M150,165 L250,165 L248,205 L152,205Z',
  },
  {
    region: 'sacro-iliaque', side: 'bilateral',
    path: 'M152,205 L248,205 L245,230 L155,230Z',
  },
  // Coude — split R/L
  {
    region: 'coude', side: 'right',
    path: 'M100,175 Q95,165 90,175 Q85,190 92,195 L108,195 Q115,190 110,175Z',
  },
  {
    region: 'coude', side: 'left',
    path: 'M290,175 Q295,165 300,175 Q305,190 298,195 L282,195 Q275,190 280,175Z',
  },
  // Poignet/Main — split R/L
  {
    region: 'poignet', side: 'right',
    path: 'M80,235 Q75,225 72,235 Q68,250 75,260 L95,260 Q100,250 97,240Z',
  },
  {
    region: 'poignet', side: 'left',
    path: 'M305,235 Q310,225 313,235 Q317,250 310,260 L290,260 Q285,250 288,240Z',
  },
  // Hanche — split R/L
  {
    region: 'hanche', side: 'right',
    path: 'M155,230 L195,230 L185,275 L145,275Z',
  },
  {
    region: 'hanche', side: 'left',
    path: 'M205,230 L245,230 L255,275 L215,275Z',
  },
  // Genou — split R/L
  {
    region: 'genou', side: 'right',
    path: 'M150,365 Q145,355 148,365 Q145,385 152,390 L178,390 Q185,385 182,370 Q185,360 180,355Z',
  },
  {
    region: 'genou', side: 'left',
    path: 'M220,365 Q215,355 218,365 Q215,385 222,390 L248,390 Q255,385 252,370 Q255,360 250,355Z',
  },
  // Cheville — split R/L
  {
    region: 'cheville', side: 'right',
    path: 'M152,485 Q148,475 150,485 Q148,500 155,505 L175,505 Q182,500 180,490 Q182,480 178,475Z',
  },
  {
    region: 'cheville', side: 'left',
    path: 'M222,485 Q218,475 220,485 Q218,500 225,505 L245,505 Q252,500 250,490 Q252,480 248,475Z',
  },
  // Pied — split R/L
  {
    region: 'pied', side: 'right',
    path: 'M148,505 L180,505 L185,530 Q185,540 165,545 Q145,540 143,530Z',
  },
  {
    region: 'pied', side: 'left',
    path: 'M220,505 L252,505 L257,530 Q257,540 237,545 Q217,540 215,530Z',
  },
]

// Back view paths — posterior anatomy
// Patient orientation is the same: patient RIGHT = drawing LEFT (x < 200)
const BACK_PATHS: PathEntry[] = [
  {
    region: 'crane', side: 'bilateral',
    path: 'M175,30 Q175,10 200,10 Q225,10 225,30 Q225,55 200,60 Q175,55 175,30Z',
  },
  {
    region: 'cervical', side: 'bilateral',
    path: 'M185,60 L215,60 L218,90 L182,90Z',
  },
  // Posterior shoulder — split R/L
  {
    region: 'epaule', side: 'right',
    path: 'M140,90 Q128,88 122,100 Q118,114 128,118 L155,112 L155,90Z',
  },
  {
    region: 'epaule', side: 'left',
    path: 'M245,90 L262,90 Q272,88 278,100 Q282,114 272,118 L245,112Z',
  },
  {
    region: 'thoracique', side: 'bilateral',
    path: 'M155,90 L245,90 L248,155 L152,155Z',
  },
  {
    region: 'cotes', side: 'bilateral',
    path: 'M152,155 L248,155 L252,185 L148,185Z',
  },
  {
    region: 'lombaire', side: 'bilateral',
    path: 'M148,185 L252,185 L250,220 L150,220Z',
  },
  {
    region: 'sacro-iliaque', side: 'bilateral',
    path: 'M150,220 L250,220 L246,248 L154,248Z',
  },
  // Posterior elbow — split R/L
  {
    region: 'coude', side: 'right',
    path: 'M102,178 Q96,168 90,178 Q84,193 91,198 L109,198 Q116,193 110,178Z',
  },
  {
    region: 'coude', side: 'left',
    path: 'M288,178 Q294,168 300,178 Q306,193 299,198 L281,198 Q274,193 280,178Z',
  },
  // Posterior wrist — split R/L
  {
    region: 'poignet', side: 'right',
    path: 'M81,236 Q76,226 72,236 Q68,252 75,262 L95,262 Q101,252 97,240Z',
  },
  {
    region: 'poignet', side: 'left',
    path: 'M304,236 Q309,226 313,236 Q317,252 310,262 L290,262 Q285,252 288,240Z',
  },
  // Gluteal / posterior hip — split R/L
  {
    region: 'hanche', side: 'right',
    path: 'M155,248 L195,248 L192,295 L148,292Z',
  },
  {
    region: 'hanche', side: 'left',
    path: 'M205,248 L245,248 L252,292 L208,295Z',
  },
  // Posterior knee — split R/L
  {
    region: 'genou', side: 'right',
    path: 'M152,368 Q146,358 149,368 Q146,388 153,393 L179,393 Q186,388 183,372 Q186,362 181,357Z',
  },
  {
    region: 'genou', side: 'left',
    path: 'M219,368 Q214,358 217,368 Q214,388 221,393 L247,393 Q254,388 251,372 Q254,362 249,357Z',
  },
  // Posterior ankle (Achilles) — split R/L
  {
    region: 'cheville', side: 'right',
    path: 'M153,487 Q149,477 151,487 Q149,502 156,507 L176,507 Q183,502 181,492 Q183,482 179,477Z',
  },
  {
    region: 'cheville', side: 'left',
    path: 'M221,487 Q217,477 219,487 Q217,502 224,507 L244,507 Q251,502 249,492 Q251,482 247,477Z',
  },
  // Plantar / posterior foot — split R/L
  {
    region: 'pied', side: 'right',
    path: 'M149,507 L181,507 L186,532 Q186,542 166,547 Q146,542 144,532Z',
  },
  {
    region: 'pied', side: 'left',
    path: 'M219,507 L251,507 L256,532 Q256,542 236,547 Q216,542 214,532Z',
  },
]

// General/systemic regions shown as buttons (not on SVG)
const GENERAL_REGIONS: AnatomicalRegion[] = ['neurologique', 'vasculaire', 'systemique']

// ─── Component ───────────────────────────────────────────────────────────────

export function BodyDiagramAnamnesis({ value, onChange, disabled }: BodyDiagramAnamnesisProps) {
  const [view, setView] = useState<'front' | 'back'>('front')
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [diagnostics, setDiagnostics] = useState<Record<string, OsteoupgradePathology[]>>({})
  const [diagLoading, setDiagLoading] = useState(false)
  const [diagError, setDiagError] = useState<string | null>(null)
  const [diagConnected, setDiagConnected] = useState<boolean | null>(null)
  const [expandedDiagRegion, setExpandedDiagRegion] = useState<string | null>(null)

  // Derive selected keys set for quick lookup
  const selectedKeys = new Set(value.map((z) => getZoneKey(z.region, z.side)))

  // ── Zone toggle logic ────────────────────────────────────────────────────
  const toggleZone = useCallback(
    (region: AnatomicalRegion, side: BodySide) => {
      if (disabled) return
      const key = getZoneKey(region, side)
      if (selectedKeys.has(key)) {
        onChange(value.filter((z) => getZoneKey(z.region, z.side) !== key))
      } else {
        onChange([...value, { region, side, notes: '' }])
      }
    },
    [disabled, value, onChange, selectedKeys]
  )

  const removeZone = useCallback(
    (region: AnatomicalRegion, side: BodySide) => {
      const key = getZoneKey(region, side)
      onChange(value.filter((z) => getZoneKey(z.region, z.side) !== key))
    },
    [value, onChange]
  )

  const updateNotes = useCallback(
    (region: AnatomicalRegion, side: BodySide, notes: string) => {
      const key = getZoneKey(region, side)
      onChange(
        value.map((z) => (getZoneKey(z.region, z.side) === key ? { ...z, notes } : z))
      )
    },
    [value, onChange]
  )

  // ── Fetch diagnostics when zones change ─────────────────────────────────
  useEffect(() => {
    if (value.length === 0) {
      setDiagnostics({})
      setDiagError(null)
      return
    }

    const regions = [...new Set(value.map((z) => z.region))].filter(
      (r) => !GENERAL_REGIONS.includes(r as AnatomicalRegion)
    )
    if (regions.length === 0) return

    const controller = new AbortController()
    const timeout = setTimeout(async () => {
      setDiagLoading(true)
      setDiagError(null)
      try {
        const resp = await fetch(
          `/api/osteoupgrade/diagnostics?regions=${regions.join(',')}`,
          { signal: controller.signal }
        )
        if (resp.status === 401) {
          setDiagConnected(false)
          setDiagLoading(false)
          return
        }
        if (!resp.ok) throw new Error('Erreur serveur')
        const data = await resp.json()
        setDiagConnected(true)
        const flat: Record<string, OsteoupgradePathology[]> = {}
        Object.entries(data.diagnostics || {}).forEach(([region, val]) => {
          flat[region] = Array.isArray(val)
            ? (val as OsteoupgradePathology[])
            : ((val as { pathologies?: OsteoupgradePathology[] }).pathologies ?? [])
        })
        setDiagnostics(flat)
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setDiagError('Impossible de charger les suggestions')
        }
      } finally {
        setDiagLoading(false)
      }
    }, 600)

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [value])

  // Check connection status on mount
  useEffect(() => {
    fetch('/api/osteoupgrade/status')
      .then((r) => r.json())
      .then((d) => setDiagConnected(d.connected))
      .catch(() => setDiagConnected(false))
  }, [])

  // ── SVG render helper ────────────────────────────────────────────────────
  const paths = view === 'front' ? FRONT_PATHS : BACK_PATHS

  const renderPath = ({ region, side, path }: PathEntry) => {
    const key = getZoneKey(region, side)
    const isSelected = selectedKeys.has(key)
    const isHovered = hoveredKey === key

    return (
      <path
        key={key}
        d={path}
        fill={
          isSelected
            ? 'rgba(220, 38, 38, 0.55)'
            : isHovered
            ? 'rgba(220, 38, 38, 0.25)'
            : 'rgba(99, 102, 241, 0.12)'
        }
        stroke={
          isSelected ? '#dc2626' : isHovered ? '#ef4444' : '#818cf8'
        }
        strokeWidth={isSelected || isHovered ? 2 : 1}
        className={disabled ? 'cursor-default' : 'cursor-pointer transition-all duration-150'}
        onClick={() => toggleZone(region, side)}
        onMouseEnter={() => setHoveredKey(key)}
        onMouseLeave={() => setHoveredKey(null)}
      >
        <title>
          {REGION_LABELS[region]}
          {side !== 'bilateral' ? ` (${SIDE_LABELS_FULL[side]})` : ''}
        </title>
      </path>
    )
  }

  // ── Unique regions in current selection (for diagnostics display) ────────
  const selectedRegions = [...new Set(value.map((z) => z.region))].filter(
    (r) => !GENERAL_REGIONS.includes(r as AnatomicalRegion)
  )

  return (
    <div className="space-y-4">
      {/* ── View toggle ── */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground font-medium">Vue :</span>
        <div className="flex rounded-lg border border-input overflow-hidden text-sm">
          <button
            type="button"
            onClick={() => setView('front')}
            className={`px-3 py-1.5 transition-colors ${
              view === 'front'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background hover:bg-muted text-foreground'
            }`}
          >
            Antérieure
          </button>
          <button
            type="button"
            onClick={() => setView('back')}
            className={`px-3 py-1.5 border-l border-input transition-colors ${
              view === 'back'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background hover:bg-muted text-foreground'
            }`}
          >
            Postérieure
          </button>
        </div>
        {value.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {value.length} zone{value.length > 1 ? 's' : ''} sélectionnée{value.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Body SVG ── */}
      <div className="flex gap-6 items-start">
        <div className="flex-shrink-0">
          <svg
            viewBox="60 0 280 560"
            className="w-[180px] h-auto select-none"
            role="img"
            aria-label={`Corps humain vue ${view === 'front' ? 'antérieure' : 'postérieure'} — cliquez pour sélectionner une zone`}
          >
            {/* Silhouette background */}
            <path d={BODY_SILHOUETTE} fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />

            {/* Clickable region paths */}
            {paths.map(renderPath)}

            {/* Hovered label */}
            {hoveredKey && (() => {
              const hPath = paths.find((p) => getZoneKey(p.region, p.side) === hoveredKey)
              return null // handled by <title> tooltip
              // eslint-disable-next-line no-unreachable
              return hPath ? null : null
            })()}
          </svg>

          {/* Tooltip */}
          {hoveredKey && (() => {
            const hp = paths.find((p) => getZoneKey(p.region, p.side) === hoveredKey)
            if (!hp) return null
            return (
              <div className="text-center mt-1 text-xs font-medium text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">
                {REGION_LABELS[hp.region]}
                {hp.side !== 'bilateral' ? ` (${SIDE_LABELS_FULL[hp.side]})` : ''}
              </div>
            )
          })()}
        </div>

        {/* ── Right panel: zones + notes ── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* General regions */}
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-2">Régions générales</p>
            <div className="flex flex-wrap gap-2">
              {GENERAL_REGIONS.map((region) => {
                const key = getZoneKey(region as AnatomicalRegion, 'bilateral')
                const isSelected = selectedKeys.has(key)
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleZone(region as AnatomicalRegion, 'bilateral')}
                    disabled={disabled}
                    className={`px-3 py-1 rounded-full text-xs font-medium border-2 transition-all ${
                      isSelected
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-background text-muted-foreground border-border hover:border-red-300 hover:bg-red-50'
                    } ${disabled ? 'opacity-50 cursor-default' : 'cursor-pointer'}`}
                  >
                    {REGION_LABELS[region as AnatomicalRegion]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selected zones chips */}
          {value.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-2">Zones sélectionnées</p>
              <div className="flex flex-wrap gap-1.5">
                {value.map((zone) => (
                  <Badge
                    key={getZoneKey(zone.region, zone.side)}
                    variant="outline"
                    className="gap-1 pl-2 pr-1 py-0.5 bg-red-50 border-red-300 text-red-700 text-xs"
                  >
                    {REGION_LABELS[zone.region]}
                    {zone.side !== 'bilateral' && (
                      <span className="font-bold">{SIDE_LABELS[zone.side]}</span>
                    )}
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => removeZone(zone.region, zone.side)}
                        className="ml-0.5 hover:text-red-900 rounded"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Notes per zone */}
          {value.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground font-medium">Notes par zone</p>
              {value.map((zone) => (
                <div key={getZoneKey(zone.region, zone.side)} className="space-y-1">
                  <Label className="text-xs font-medium text-foreground">
                    {getZoneLabel(zone.region, zone.side)}
                  </Label>
                  <Textarea
                    value={zone.notes}
                    onChange={(e) => updateNotes(zone.region, zone.side, e.target.value)}
                    disabled={disabled}
                    placeholder={`Douleurs, circonstances, EVA... (${getZoneLabel(zone.region, zone.side)})`}
                    rows={2}
                    className="text-sm min-h-[60px] resize-none"
                  />
                </div>
              ))}
            </div>
          )}

          {value.length === 0 && (
            <div className="flex items-center justify-center h-24 rounded-lg border-2 border-dashed border-muted text-muted-foreground text-sm">
              Cliquez sur le corps pour marquer les zones douloureuses
            </div>
          )}
        </div>
      </div>

      {/* ── Diagnostic suggestions ── */}
      {value.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border-b border-indigo-100">
            <BookOpen className="h-4 w-4 text-indigo-600 flex-shrink-0" />
            <span className="text-sm font-medium text-indigo-800">
              Suggestions diagnostiques — Osteoupgrade
            </span>
            {diagLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500 ml-auto" />}
          </div>

          <div className="p-4">
            {/* Not connected */}
            {diagConnected === false && (
              <div className="flex items-start gap-3 py-2">
                <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Compte Osteoupgrade requis.</span>{' '}
                  Connectez votre compte dans{' '}
                  <a href="/settings" className="text-primary underline underline-offset-2">
                    Paramètres → Osteoupgrade
                  </a>{' '}
                  pour accéder aux diagnostics et tests orthopédiques.
                </div>
              </div>
            )}

            {/* Error */}
            {diagError && diagConnected !== false && (
              <p className="text-sm text-destructive">{diagError}</p>
            )}

            {/* Diagnostics per region */}
            {diagConnected === true && !diagLoading && selectedRegions.length > 0 && (
              <div className="space-y-3">
                {selectedRegions.map((region) => {
                  const normalized = region.toLowerCase().trim()
                  const pathologies = diagnostics[normalized] || []
                  const isExpanded = expandedDiagRegion === region

                  return (
                    <div key={region} className="border rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandedDiagRegion(isExpanded ? null : region)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/70 transition-colors text-sm"
                      >
                        <span className="font-medium">{REGION_LABELS[region as AnatomicalRegion]}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {pathologies.length > 0
                              ? `${pathologies.length} diagnostic${pathologies.length > 1 ? 's' : ''}`
                              : 'Aucun diagnostic'}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="divide-y divide-border">
                          {pathologies.length === 0 ? (
                            <p className="px-3 py-3 text-sm text-muted-foreground italic">
                              Aucun diagnostic configuré pour cette région.
                            </p>
                          ) : (
                            pathologies.map((pathology) => (
                              <div key={pathology.id} className="px-3 py-2.5">
                                <div className="flex items-start gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-medium text-foreground">
                                        {pathology.name}
                                      </span>
                                      {pathology.is_red_flag && (
                                        <Badge variant="destructive" className="text-xs px-1.5 py-0">
                                          Red flag
                                        </Badge>
                                      )}
                                    </div>

                                    {pathology.clinical_signs && (
                                      <ul className="mt-1 space-y-0.5">
                                        {pathology.clinical_signs
                                          .split('\n')
                                          .filter((s) => s.trim())
                                          .slice(0, 3)
                                          .map((sign, i) => (
                                            <li
                                              key={i}
                                              className="text-xs text-muted-foreground flex gap-1.5"
                                            >
                                              <span className="text-indigo-400 flex-shrink-0">•</span>
                                              {sign.trim()}
                                            </li>
                                          ))}
                                      </ul>
                                    )}
                                  </div>

                                  {pathology.is_red_flag && pathology.red_flag_reason && (
                                    <div
                                      className="flex-shrink-0 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 max-w-[160px]"
                                      title={pathology.red_flag_reason}
                                    >
                                      <AlertCircle className="h-3 w-3 inline mr-1" />
                                      {pathology.red_flag_reason.slice(0, 40)}
                                      {pathology.red_flag_reason.length > 40 ? '…' : ''}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))
                          )}

                          {/* Link to Osteoupgrade for full details */}
                          <div className="px-3 py-2 bg-muted/20">
                            <a
                              href="https://app.osteo-upgrade.fr"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Voir tests orthopédiques et détails sur Osteoupgrade
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {diagConnected === true && !diagLoading && selectedRegions.length === 0 && (
              <p className="text-sm text-muted-foreground italic">
                Sélectionnez une zone anatomique pour voir les diagnostics associés.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
