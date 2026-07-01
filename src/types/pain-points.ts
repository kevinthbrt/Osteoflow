/**
 * Points/zones/trajets douloureux positionnés sur la bodychart (face/dos).
 * Alternative à l'anamnèse structurée classique : chaque marqueur porte le
 * détail de la douleur à cet endroit, et peut être enrichi (examen clinique,
 * traitement, hypothèses liées) au clic.
 */

export type PainPointKind = 'point' | 'zone' | 'path'
export type BodyView = 'front' | 'back'

/** Coordonnées en pourcentage (0–100) de la largeur/hauteur du schéma corporel. */
export interface PainCoord {
  x: number
  y: number
}

export interface PainPoint {
  id: string
  kind: PainPointKind
  view: BodyView
  /** Un point pour "point", un tracé ouvert pour "path", un polygone fermé pour "zone". */
  coords: PainCoord[]
  /** Libellé court (ex. région anatomique) affiché sur le marqueur et la carte. */
  label: string
  /** Détail de la douleur : type, intensité, irradiations, facteurs modulants… */
  detail: string
  examen_clinique?: string
  traitement?: string
  /** Ids des hypothèses (HypothesesPayload.hypotheses[].id) liées à ce point. */
  hypothesis_ids?: number[]
}
