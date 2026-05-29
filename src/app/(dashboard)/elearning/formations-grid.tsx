'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  GraduationCap,
  Loader2,
  PlayCircle,
  CheckCircle2,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type Formation = {
  id: string
  title: string
  description: string | null
  photo_url: string | null
  is_featured_osteoflow: boolean
  total: number
  completed: number
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function FormationCard({
  formation,
  onOpen,
}: {
  formation: Formation
  onOpen: () => void
}) {
  const pct = formation.total > 0
    ? Math.round((formation.completed / formation.total) * 100)
    : 0
  const done = pct === 100
  const started = formation.completed > 0

  return (
    <div className="group flex flex-col rounded-2xl border border-border/40 bg-card overflow-hidden hover:border-violet-200 hover:shadow-md transition-all duration-200">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-violet-50 dark:bg-violet-950/20 overflow-hidden flex-shrink-0">
        {formation.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={formation.photo_url}
            alt={formation.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <GraduationCap className="h-12 w-12 text-violet-200 dark:text-violet-800" />
          </div>
        )}
        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-1.5">
          {formation.is_featured_osteoflow && (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-violet-600 text-white shadow">
              <Sparkles className="h-2.5 w-2.5" /> Nouveau
            </span>
          )}
          {done && (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-500 text-white shadow">
              <CheckCircle2 className="h-2.5 w-2.5" /> Terminé
            </span>
          )}
        </div>
        {/* Progress overlay */}
        {formation.total > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
            <div
              className={`h-full transition-all duration-500 ${done ? 'bg-emerald-400' : 'bg-violet-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-sm leading-snug line-clamp-2 mb-1">{formation.title}</h3>
          {formation.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {stripHtml(formation.description)}
            </p>
          )}
        </div>

        {/* Progress row */}
        {formation.total > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{formation.completed}/{formation.total} modules</span>
              <span className={`font-semibold tabular-nums ${done ? 'text-emerald-600' : 'text-violet-600'}`}>
                {pct}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-emerald-500' : 'bg-violet-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* CTA */}
        <Button
          size="sm"
          onClick={onOpen}
          className={`w-full gap-2 ${
            done
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : started
              ? 'bg-violet-600 hover:bg-violet-700'
              : 'bg-violet-500 hover:bg-violet-600'
          }`}
        >
          {done ? (
            <><RotateCcw className="h-3.5 w-3.5" /> Revoir</>
          ) : started ? (
            <><PlayCircle className="h-3.5 w-3.5" /> Reprendre</>
          ) : (
            <><PlayCircle className="h-3.5 w-3.5" /> Commencer</>
          )}
        </Button>
      </div>
    </div>
  )
}

export function FormationsGrid({ practitionerEmail }: { practitionerEmail: string }) {
  const router = useRouter()
  const [formations, setFormations] = useState<Formation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    const params = new URLSearchParams({ email: practitionerEmail })
    fetch(`/api/osteoupgrade-formations?${params}`, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((data) => {
        setFormations(Array.isArray(data) ? data : [])
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [practitionerEmail])

  const featured = formations.filter((f) => f.is_featured_osteoflow)
  const others = formations.filter((f) => !f.is_featured_osteoflow)

  const totalCompleted = formations.reduce((sum, f) => sum + f.completed, 0)
  const totalModules = formations.reduce((sum, f) => sum + f.total, 0)
  const overallPct = totalModules > 0 ? Math.round((totalCompleted / totalModules) * 100) : 0

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl px-6 py-5 text-white bg-gradient-to-r from-violet-600 to-indigo-600">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-xl" />
        <div className="relative z-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <GraduationCap className="h-5 w-5 text-white/70" />
              <span className="text-sm text-white/70">OsteoUpgrade</span>
            </div>
            <h1 className="text-2xl font-bold">Mes formations</h1>
          </div>
          {!loading && formations.length > 0 && (
            <div className="flex flex-col gap-1.5 min-w-48">
              <div className="flex justify-between text-sm text-white/80">
                <span>{totalCompleted}/{totalModules} modules au total</span>
                <span className="font-bold">{overallPct}%</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-700"
                  style={{ width: `${overallPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <GraduationCap className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">Impossible de charger les formations.</p>
          <Button variant="outline" onClick={() => window.location.reload()}>Réessayer</Button>
        </div>
      ) : formations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <GraduationCap className="h-12 w-12 text-muted-foreground/30" />
          <div>
            <p className="font-medium text-sm">Aucune formation disponible</p>
            <p className="text-xs text-muted-foreground mt-1">
              Connectez votre compte OsteoUpgrade pour accéder aux formations.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Featured (new) */}
          {featured.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-violet-500" /> Nouveauté
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {featured.map((f) => (
                  <FormationCard
                    key={f.id}
                    formation={f}
                    onOpen={() => router.push(`/formation/${f.id}`)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* All other formations */}
          {others.length > 0 && (
            <section className="space-y-3">
              {featured.length > 0 && (
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Toutes les formations
                </h2>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {others.map((f) => (
                  <FormationCard
                    key={f.id}
                    formation={f}
                    onOpen={() => router.push(`/formation/${f.id}`)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
