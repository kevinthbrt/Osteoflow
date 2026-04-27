import type {
  BodyMarker,
  BodyView,
  ConsultationAnnotations,
  ConsultationNotesStructured,
  NoteEntry,
  NoteSection,
} from '@/types/database'

export const BODY_SVG_WIDTH = 400
export const BODY_SVG_HEIGHT = 720

export interface BodyRegion {
  id: string
  cx: number
  cy: number
  r: number
  label: string
}

export const FRONT_REGIONS: BodyRegion[] = [
  { id: 'head', cx: 200, cy: 55, r: 38, label: 'Tête' },
  { id: 'neck-f', cx: 200, cy: 100, r: 18, label: 'Cervicales' },
  { id: 'l-shoulder-f', cx: 130, cy: 150, r: 22, label: 'Épaule G' },
  { id: 'r-shoulder-f', cx: 270, cy: 150, r: 22, label: 'Épaule D' },
  { id: 'chest', cx: 200, cy: 180, r: 30, label: 'Thorax' },
  { id: 'l-elbow-f', cx: 108, cy: 255, r: 18, label: 'Coude G' },
  { id: 'r-elbow-f', cx: 292, cy: 255, r: 18, label: 'Coude D' },
  { id: 'abdomen', cx: 200, cy: 280, r: 30, label: 'Abdomen' },
  { id: 'l-wrist-f', cx: 98, cy: 355, r: 14, label: 'Poignet G' },
  { id: 'r-wrist-f', cx: 302, cy: 355, r: 14, label: 'Poignet D' },
  { id: 'pelvis', cx: 200, cy: 350, r: 24, label: 'Bassin' },
  { id: 'l-hip-f', cx: 172, cy: 380, r: 18, label: 'Hanche G' },
  { id: 'r-hip-f', cx: 228, cy: 380, r: 18, label: 'Hanche D' },
  { id: 'l-thigh-f', cx: 168, cy: 440, r: 22, label: 'Cuisse G' },
  { id: 'r-thigh-f', cx: 232, cy: 440, r: 22, label: 'Cuisse D' },
  { id: 'l-knee-f', cx: 167, cy: 495, r: 18, label: 'Genou G' },
  { id: 'r-knee-f', cx: 233, cy: 495, r: 18, label: 'Genou D' },
  { id: 'l-shin', cx: 165, cy: 570, r: 20, label: 'Tibia G' },
  { id: 'r-shin', cx: 235, cy: 570, r: 20, label: 'Tibia D' },
  { id: 'l-ankle-f', cx: 160, cy: 660, r: 14, label: 'Cheville G' },
  { id: 'r-ankle-f', cx: 240, cy: 660, r: 14, label: 'Cheville D' },
  { id: 'l-foot', cx: 160, cy: 685, r: 14, label: 'Pied G' },
  { id: 'r-foot', cx: 240, cy: 685, r: 14, label: 'Pied D' },
]

export const BACK_REGIONS: BodyRegion[] = [
  { id: 'occiput', cx: 200, cy: 55, r: 38, label: 'Occiput' },
  { id: 'neck-b', cx: 200, cy: 100, r: 18, label: 'Cervicales post.' },
  { id: 'l-trap', cx: 160, cy: 130, r: 22, label: 'Trapèze G' },
  { id: 'r-trap', cx: 240, cy: 130, r: 22, label: 'Trapèze D' },
  { id: 'upper-back', cx: 200, cy: 170, r: 26, label: 'Dorsales hautes' },
  { id: 'l-scapula', cx: 165, cy: 190, r: 20, label: 'Omoplate G' },
  { id: 'r-scapula', cx: 235, cy: 190, r: 20, label: 'Omoplate D' },
  { id: 'mid-back', cx: 200, cy: 230, r: 22, label: 'Dorsales' },
  { id: 'l-elbow-b', cx: 108, cy: 255, r: 18, label: 'Coude G' },
  { id: 'r-elbow-b', cx: 292, cy: 255, r: 18, label: 'Coude D' },
  { id: 'lumbar', cx: 200, cy: 300, r: 24, label: 'Lombaires' },
  { id: 'l-wrist-b', cx: 98, cy: 355, r: 14, label: 'Poignet G' },
  { id: 'r-wrist-b', cx: 302, cy: 355, r: 14, label: 'Poignet D' },
  { id: 'sacrum', cx: 200, cy: 350, r: 22, label: 'Sacrum' },
  { id: 'l-glute', cx: 175, cy: 385, r: 20, label: 'Fessier G' },
  { id: 'r-glute', cx: 225, cy: 385, r: 20, label: 'Fessier D' },
  { id: 'l-hamstring', cx: 168, cy: 450, r: 22, label: 'Ischio G' },
  { id: 'r-hamstring', cx: 232, cy: 450, r: 22, label: 'Ischio D' },
  { id: 'l-knee-b', cx: 167, cy: 495, r: 18, label: 'Creux poplité G' },
  { id: 'r-knee-b', cx: 233, cy: 495, r: 18, label: 'Creux poplité D' },
  { id: 'l-calf', cx: 165, cy: 570, r: 22, label: 'Mollet G' },
  { id: 'r-calf', cx: 235, cy: 570, r: 22, label: 'Mollet D' },
  { id: 'l-achilles', cx: 160, cy: 660, r: 14, label: 'Achille G' },
  { id: 'r-achilles', cx: 240, cy: 660, r: 14, label: 'Achille D' },
]

export function regionsForView(view: BodyView): BodyRegion[] {
  return view === 'front' ? FRONT_REGIONS : BACK_REGIONS
}

export function findNearestRegion(view: BodyView, x: number, y: number): BodyRegion | null {
  const regions = regionsForView(view)
  let best: BodyRegion | null = null
  let bestDist = Infinity
  for (const r of regions) {
    const d = Math.hypot(r.cx - x, r.cy - y)
    if (d < bestDist) {
      bestDist = d
      best = r
    }
  }
  return best
}

export function painColor(eva: number): string {
  if (eva <= 2) return 'hsl(152 60% 42%)'
  if (eva <= 4) return 'hsl(90 60% 42%)'
  if (eva <= 6) return 'hsl(40 95% 44%)'
  if (eva <= 8) return 'hsl(25 95% 48%)'
  return 'hsl(0 80% 52%)'
}

export function emptyAnnotations(): ConsultationAnnotations {
  return { version: 1, markers: [], paths: [] }
}

export function emptyNotesStructured(): ConsultationNotesStructured {
  return { version: 1, anamnesis: [], examination: [], treatment: [], advice: [] }
}

export const NOTE_SECTION_LABELS: Record<NoteSection, string> = {
  anamnesis: 'Anamnèse',
  examination: 'Examen',
  treatment: 'Traitement',
  advice: 'Conseils',
}

export const NOTE_SECTION_ORDER: NoteSection[] = ['anamnesis', 'examination', 'treatment', 'advice']

export function countMarkers(annotations: ConsultationAnnotations | null | undefined): number {
  return annotations?.markers?.length ?? 0
}

export function averageEva(markers: BodyMarker[]): number | null {
  if (!markers.length) return null
  const sum = markers.reduce((acc, m) => acc + m.eva, 0)
  return sum / markers.length
}

export function countNotes(notes: ConsultationNotesStructured | null | undefined): number {
  if (!notes) return 0
  return (
    notes.anamnesis.length +
    notes.examination.length +
    notes.treatment.length +
    notes.advice.length
  )
}

export function notesToLegacyText(entries: NoteEntry[]): string {
  return entries.map((e) => (e.markerLabel ? `[${e.markerLabel}] ${e.text}` : e.text)).join('\n')
}

export function hasStructuredContent(
  annotations: ConsultationAnnotations | null | undefined,
  notes: ConsultationNotesStructured | null | undefined,
): boolean {
  return countMarkers(annotations) > 0 || countNotes(notes) > 0
}
