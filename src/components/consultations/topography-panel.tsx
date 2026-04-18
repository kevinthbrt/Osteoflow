'use client'

import { useState, useMemo } from 'react'
import { X, Search, MapPin, ChevronRight, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type AnatomicalRegion = {
  id: string
  label: string
  category: string
  structures: string[]
  techniques: string[]
}

const CATEGORIES = [
  { id: 'tete-cou', label: 'Tête & Cou' },
  { id: 'membre-superieur', label: 'Membre supérieur' },
  { id: 'tronc', label: 'Tronc' },
  { id: 'membre-inferieur', label: 'Membre inférieur' },
  { id: 'general', label: 'Général' },
]

const REGIONS: AnatomicalRegion[] = [
  {
    id: 'cervical',
    label: 'Rachis cervical',
    category: 'tete-cou',
    structures: ['Atlas (C1)', 'Axis (C2)', 'C3–C7', 'Occiput', 'Muscles sous-occipitaux', 'SCM', 'Scalènes', 'Artère vertébrale'],
    techniques: ['HVBA C1/C2', 'Pompage cervical', 'Inhibition sous-occipitale', 'Muscle énergie', 'Traction cervicale douce'],
  },
  {
    id: 'atm',
    label: 'ATM',
    category: 'tete-cou',
    structures: ['Condyle mandibulaire', 'Ménisque articulaire', 'Ligament latéral', 'Masséter', 'Temporal', 'Ptérygoïdiens', 'Digastrique'],
    techniques: ['Décompression ATM', 'Rééquilibration musculaire', 'Traitement intra-buccal', 'Travail fascial'],
  },
  {
    id: 'crane',
    label: 'Crâne',
    category: 'tete-cou',
    structures: ['Frontal', 'Pariétaux', 'Temporal', 'Occiput', 'Sphénoïde', 'Ethmoïde', 'SSB', 'Dure-mère'],
    techniques: ['CV4', 'Décompression SBS', 'Membranes de tension réciproque', 'Lift sphénoïdal'],
  },
  {
    id: 'epaule',
    label: 'Épaule',
    category: 'membre-superieur',
    structures: ['Acromion', 'Clavicule', 'Omoplate', 'Coiffe des rotateurs', 'Supra-épineux', 'Infra-épineux', 'Subscapulaire', 'Teres minor', 'Long biceps', 'Bourse sous-acromiale'],
    techniques: ['Mobilisation GH', 'HVBA ACJ', 'Pompage de l\'épaule', 'Travail coiffe', 'Spencer'],
  },
  {
    id: 'coude',
    label: 'Coude',
    category: 'membre-superieur',
    structures: ['Épicondyle latéral', 'Épicondyle médial', 'Tête radiale', 'Olécrane', 'Ligament annulaire', 'Muscles épicondyliens', 'Nerf cubital'],
    techniques: ['HVBA tête radiale', 'Mill\'s maneuver', 'Inhibition épicondyliens', 'Pompage du coude'],
  },
  {
    id: 'poignet',
    label: 'Poignet & Main',
    category: 'membre-superieur',
    structures: ['Scaphoïde', 'Lunatum', 'Triquetrum', 'Pisiforme', 'Trapèze', 'Grand os', 'Hamatum', 'Canal carpien', 'Nerf médian'],
    techniques: ['Mobilisation carpienne', 'Pompage radio-cubital', 'Décompression canal carpien', 'Technique du Colles'],
  },
  {
    id: 'thoracique',
    label: 'Rachis thoracique',
    category: 'tronc',
    structures: ['T1–T12', 'Art. costo-vertébrales', 'Art. costo-transversaires', 'Diaphragme', 'Plèvres', 'Muscles paravertébraux', 'Trapèze', 'Rhomboïdes'],
    techniques: ['HVBA thoracique', 'Technique du bras de levier', 'Pompage thoracique', 'Travail costal', 'Muscle énergie'],
  },
  {
    id: 'lombaire',
    label: 'Rachis lombaire',
    category: 'tronc',
    structures: ['L1–L5', 'Disques intervertébraux', 'Psoas-iliaque', 'Carré des lombes', 'Muscles paravertébraux lombaires', 'Ligament ilio-lombaire'],
    techniques: ['HVBA lombaire', 'Technique de la "chaise"', 'Pompage lombaire', 'Muscle énergie', 'Technique en décubitus'],
  },
  {
    id: 'sacro-iliaque',
    label: 'Bassin & Sacro-iliaque',
    category: 'tronc',
    structures: ['Sacrum', 'Ilium', 'Art. SI', 'Ligaments SI', 'Pubis', 'Coccyx', 'Piriformis', 'Ligament sacro-tubéral'],
    techniques: ['HVBA SI', 'Technique du sacrum', 'Correction des iliums', 'Correction pubienne', 'Muscle énergie SI'],
  },
  {
    id: 'cotes',
    label: 'Côtes',
    category: 'tronc',
    structures: ['Côtes 1–12', 'Sternum', 'Cartilages costaux', 'Art. chondro-sternales', 'Intercostaux', '1ère côte'],
    techniques: ['Pompage costal', 'Technique de la 1ère côte', 'Correction insp./exp.', 'Art. costo-vertébrale'],
  },
  {
    id: 'hanche',
    label: 'Hanche',
    category: 'membre-inferieur',
    structures: ['Tête fémorale', 'Acétabulum', 'Ligament ilio-fémoral', 'Grand trochanter', 'Psoas', 'TFL', 'Glutéaux', 'Ischio-jambiers proximaux'],
    techniques: ['HVBA hanche', 'Traction axiale', 'Pompage coxo-fémoral', 'Muscle énergie', 'Mobilisation en rotation'],
  },
  {
    id: 'genou',
    label: 'Genou',
    category: 'membre-inferieur',
    structures: ['Fémur distal', 'Tibia proximal', 'Fibula', 'Ménisques', 'LCA', 'LCP', 'LCL', 'LCM', 'Rotule', 'TTA', 'Poplité', 'Bandelette ilio-tibiale'],
    techniques: ['Mobilisation tibio-fémorale', 'HVBA péronée', 'Travail méniscal', 'Pompage du genou', 'Technique rotulienne'],
  },
  {
    id: 'cheville',
    label: 'Cheville',
    category: 'membre-inferieur',
    structures: ['Talus', 'Calcanéum', 'Malléoles', 'LTFA', 'LCF', 'LTFP', 'Ligament deltoïde', 'Tendon calcanéen', 'Tibialis posterior'],
    techniques: ['HVBA cheville', 'Correction du talus', 'Pompage tibio-tarsien', 'Technique en décharge'],
  },
  {
    id: 'pied',
    label: 'Pied',
    category: 'membre-inferieur',
    structures: ['Calcanéum', 'Cuboïde', 'Naviculaire', 'Cunéiformes', 'Métatarses', 'Phalanges', 'Fascia plantaire', 'Muscles intrinsèques'],
    techniques: ['Pompage cunéen', 'Art. médio-tarsienne', 'Technique du cuboïde', 'Correction métatarsienne'],
  },
  {
    id: 'neurologique',
    label: 'Neurologie',
    category: 'general',
    structures: ['Dure-mère spinale', 'Nerf sciatique', 'Plexus brachial', 'Nerf cubital', 'Nerf médian', 'Nerf fibulaire commun', 'Nerf tibial', 'Nerf occipital'],
    techniques: ['Neuromobilisation', 'Flossing neurologique', 'Test de Lasègue', 'Test de Spurling', 'Slump test'],
  },
  {
    id: 'vasculaire',
    label: 'Vasculaire & Viscéral',
    category: 'general',
    structures: ['Aorte abdominale', 'A. cœliaque', 'A. mésentérique', 'VCI', 'Foie', 'Rate', 'Reins', 'Intestins'],
    techniques: ['Pompage hépatique', 'Mobilisation rénale', 'Technique du diaphragme', 'Travail sur le mésentère'],
  },
  {
    id: 'systemique',
    label: 'Systémique',
    category: 'general',
    structures: ['Diaphragme thoracique', 'Péricarde', 'Plèvres', 'Péritoine', 'SNA', 'Ganglions lymphatiques'],
    techniques: ['Technique de la boîte thoracique', 'Travail sur les fascias profonds', 'Inhibition sympathique', 'Pompe lymphatique'],
  },
]

interface TopographyPanelProps {
  open: boolean
  onClose: () => void
  osteoupgradeUrl?: string
}

export function TopographyPanel({ open, onClose, osteoupgradeUrl = 'https://osteoupgrade.vercel.app' }: TopographyPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<AnatomicalRegion | null>(null)
  const [search, setSearch] = useState('')

  const filteredRegions = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return selectedCategory ? REGIONS.filter((r) => r.category === selectedCategory) : REGIONS
    return REGIONS.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.structures.some((s) => s.toLowerCase().includes(q)) ||
        r.techniques.some((t) => t.toLowerCase().includes(q))
    )
  }, [search, selectedCategory])

  const openInOsteoupgrade = () => {
    const url = `${osteoupgradeUrl}/topographie`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-[400px] max-w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-l border-white/20 shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shadow-sm">
              <MapPin className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold leading-none">Topographie</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Référence anatomique</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1.5 text-muted-foreground h-8"
              onClick={openInOsteoupgrade}
            >
              <ExternalLink className="h-3 w-3" />
              Visuels
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-border/40 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setSelectedCategory(null)
                setSelectedRegion(null)
              }}
              placeholder="Zone, structure, technique…"
              className="pl-9 h-8 text-sm bg-muted/40 border-0 focus-visible:ring-1 rounded-lg"
            />
          </div>
        </div>

        {!selectedRegion ? (
          <>
            {/* Category filters */}
            {!search && (
              <div className="flex gap-1.5 px-3 py-2.5 flex-wrap border-b border-border/40 shrink-0">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                    !selectedCategory
                      ? 'gradient-primary text-white shadow-sm'
                      : 'bg-muted hover:bg-accent text-muted-foreground'
                  )}
                >
                  Tout
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                      selectedCategory === cat.id
                        ? 'gradient-primary text-white shadow-sm'
                        : 'bg-muted hover:bg-accent text-muted-foreground'
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            )}

            {/* Region list */}
            <div className="flex-1 overflow-y-auto">
              {!search && !selectedCategory
                ? CATEGORIES.map((cat) => (
                    <div key={cat.id}>
                      <p className="px-4 py-2 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest bg-muted/30 border-b border-border/20">
                        {cat.label}
                      </p>
                      {REGIONS.filter((r) => r.category === cat.id).map((region) => (
                        <button
                          key={region.id}
                          onClick={() => setSelectedRegion(region)}
                          className="w-full text-left flex items-center justify-between px-4 py-3 hover:bg-accent/60 transition-colors group border-b border-border/10"
                        >
                          <span className="text-sm font-medium group-hover:text-primary transition-colors">{region.label}</span>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </button>
                      ))}
                    </div>
                  ))
                : filteredRegions.map((region) => (
                    <button
                      key={region.id}
                      onClick={() => setSelectedRegion(region)}
                      className="w-full text-left flex items-center justify-between px-4 py-3 hover:bg-accent/60 transition-colors group border-b border-border/10"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium group-hover:text-primary transition-colors">{region.label}</span>
                        {search && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {[...region.structures, ...region.techniques]
                              .filter((s) => s.toLowerCase().includes(search.toLowerCase()))
                              .slice(0, 2)
                              .join(' · ')}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary shrink-0 ml-2 transition-colors" />
                    </button>
                  ))}

              {filteredRegions.length === 0 && (
                <div className="px-4 py-12 text-center">
                  <p className="text-sm text-muted-foreground">Aucune zone trouvée</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Essayez un autre terme</p>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Region detail view */
          <div className="flex-1 overflow-y-auto">
            <button
              onClick={() => setSelectedRegion(null)}
              className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors w-full border-b border-border/40"
            >
              <ChevronRight className="h-3.5 w-3.5 rotate-180" />
              <span>Retour</span>
            </button>

            <div className="p-5 space-y-5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-6 rounded-full gradient-primary" />
                <h3 className="font-semibold text-base">{selectedRegion.label}</h3>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">
                  Structures anatomiques
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedRegion.structures.map((s) => (
                    <span
                      key={s}
                      className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md text-xs font-medium border border-blue-100 dark:border-blue-800/30"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">
                  Techniques ostéopathiques
                </p>
                <div className="space-y-1">
                  {selectedRegion.techniques.map((t) => (
                    <div
                      key={t}
                      className="flex items-center gap-2.5 py-2 px-3 rounded-lg hover:bg-muted/60 transition-colors"
                    >
                      <div className="w-1.5 h-1.5 rounded-full gradient-primary shrink-0" />
                      <span className="text-sm">{t}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-1 border-t border-border/40">
                <p className="text-xs text-muted-foreground mb-2">
                  Accédez aux visuels et descriptions complètes sur Osteoupgrade.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 text-xs"
                  onClick={openInOsteoupgrade}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Voir sur Osteoupgrade
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
