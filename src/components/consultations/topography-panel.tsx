'use client'

import { useState, useEffect } from 'react'
import { X, MapPin, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

const REGION_LABELS: Record<string, string> = {
  crane: 'Crâne',
  cervical: 'Cervical',
  thoracique: 'Thoracique',
  lombaire: 'Lombaire',
  epaule: 'Épaule',
  coude: 'Coude',
  poignet: 'Poignet',
  hanche: 'Hanche',
  genou: 'Genou',
  pied: 'Pied',
}

const REGION_ORDER = ['crane', 'cervical', 'thoracique', 'lombaire', 'epaule', 'coude', 'poignet', 'hanche', 'genou', 'pied']

type TopoView = {
  region: string
  name: string
  image_url: string
  description: string
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/\s*data-start="[^"]*"/g, '')
    .replace(/\s*data-end="[^"]*"/g, '')
    .replace(/<font[^>]*>/g, '')
    .replace(/<\/font>/g, '')
}

interface TopographyPanelProps {
  open: boolean
  onClose: () => void
}

export function TopographyPanel({ open, onClose }: TopographyPanelProps) {
  const [views, setViews] = useState<TopoView[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [selectedView, setSelectedView] = useState<TopoView | null>(null)

  useEffect(() => {
    if (!open) {
      setSelectedRegion(null)
      setSelectedView(null)
      return
    }
    if (views.length > 0) return
    setIsLoading(true)
    setError(false)
    fetch('/api/topography')
      .then((r) => r.json())
      .then(({ views: data }) => {
        if (Array.isArray(data) && data.length > 0) setViews(data)
        else setError(true)
      })
      .catch(() => setError(true))
      .finally(() => setIsLoading(false))
  }, [open, views.length])

  const sortedRegions = REGION_ORDER.filter((r) => views.some((v) => v.region === r))
  const regionViews = selectedRegion ? views.filter((v) => v.region === selectedRegion) : []

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-[420px] max-w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-l border-white/20 shadow-2xl flex flex-col animate-slide-in-right">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shadow-sm">
              <MapPin className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold leading-none">Topographie</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Données Osteoupgrade</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 p-8 text-center">
            <p className="text-sm text-muted-foreground">Impossible de charger les données</p>
            <p className="text-xs text-muted-foreground/60">Vérifiez votre connexion internet</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => { setError(false); setViews([]) }}
            >
              Réessayer
            </Button>
          </div>
        ) : selectedView ? (
          /* View detail */
          <div className="flex-1 overflow-y-auto">
            <button
              onClick={() => setSelectedView(null)}
              className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors w-full border-b border-border/40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>{REGION_LABELS[selectedView.region] ?? selectedView.region}</span>
            </button>
            <div className="p-4 space-y-4">
              <h3 className="font-semibold text-sm">{selectedView.name}</h3>
              <img
                src={selectedView.image_url}
                alt={selectedView.name}
                className="w-full rounded-xl border border-border/40 object-contain bg-white"
              />
              {selectedView.description && (
                <div
                  className="text-sm [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-primary [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:text-xs [&_p]:text-muted-foreground [&_p]:mb-2 [&_hr]:my-3 [&_strong]:font-semibold"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedView.description) }}
                />
              )}
            </div>
          </div>
        ) : selectedRegion ? (
          /* Region views list */
          <div className="flex-1 overflow-y-auto">
            <button
              onClick={() => setSelectedRegion(null)}
              className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors w-full border-b border-border/40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Toutes les régions</span>
            </button>
            <div className="p-2">
              {regionViews.map((view) => (
                <button
                  key={view.name}
                  onClick={() => setSelectedView(view)}
                  className="w-full text-left flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-accent/60 transition-colors group"
                >
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted shrink-0 border border-border/40">
                    <img
                      src={view.image_url}
                      alt={view.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-sm font-medium group-hover:text-primary transition-colors flex-1 text-left">
                    {view.name}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Regions list */
          <div className="flex-1 overflow-y-auto">
            <div className="p-2">
              {sortedRegions.map((regionId) => {
                const label = REGION_LABELS[regionId] ?? regionId
                const count = views.filter((v) => v.region === regionId).length
                return (
                  <button
                    key={regionId}
                    onClick={() => setSelectedRegion(regionId)}
                    className="w-full text-left flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-accent/60 transition-colors group border-b border-border/10 last:border-0"
                  >
                    <span className="text-sm font-medium group-hover:text-primary transition-colors">
                      {label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {count} vue{count > 1 ? 's' : ''}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
