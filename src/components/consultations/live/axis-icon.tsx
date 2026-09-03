'use client'

import {
  ActivityIcon,
  ArrowDownRight,
  ArrowLeftRight,
  ClipboardList,
  Clock,
  Flag,
  Flame,
  Footprints,
  Gauge,
  type LucideIcon,
  MapPin,
  Moon,
  Pill,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import type { AxisId } from '@/lib/anamnesis-live'

/**
 * Symboles des axes, en icônes plutôt qu'en emoji.
 *
 * Les emoji avaient chacun leur palette et leur graisse, changeaient de dessin
 * selon le système, et juraient avec les icônes utilisées partout ailleurs dans
 * l'application. Ici toutes les icônes partagent la même épaisseur de trait et
 * prennent la couleur du texte, ce qui laisse la couleur au seul signal.
 *
 * L'emoji reste en revanche dans les cartes ENREGISTRÉES (`anamnesis_sections`),
 * où il fait partie du format déjà en base et se rend comme du texte.
 */
export const AXIS_ICONS: Record<AxisId, LucideIcon> = {
  motif: Target,
  localisation: MapPin,
  lateralite: ArrowLeftRight,
  anciennete: Clock,
  apparition: Zap,
  type: Flame,
  intensite: Gauge,
  horaire: Moon,
  irradiation: ArrowDownRight,
  aggravant: TrendingUp,
  soulageant: TrendingDown,
  evolution: ActivityIcon,
  traitement: Pill,
  antecedent: ClipboardList,
  retentissement: Footprints,
  red_flag: Flag,
}

export function AxisIcon({ axis, className }: { axis: AxisId; className?: string }) {
  const Icon = AXIS_ICONS[axis]
  if (!Icon) return null
  return <Icon className={className} aria-hidden="true" />
}
