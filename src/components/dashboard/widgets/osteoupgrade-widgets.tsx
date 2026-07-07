'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LiteratureReviewModal } from './literature-review-modal'
import {
  BookOpen,
  GraduationCap,
  ExternalLink,
  RefreshCw,
  ChevronRight,
  Trophy,
  PlayCircle,
} from 'lucide-react'

export type LiteratureReview = {
  id: string
  title: string
  summary: string | null
  image_url: string | null
  published_date: string | null
}

export type FeaturedFormation = {
  id: string
  title: string
  description: string | null
  photo_url: string | null
}

export type WidgetsData = {
  review: LiteratureReview | null
  featured_formation: FeaturedFormation | null
}

const OSTEOUPGRADE_URL = process.env.NEXT_PUBLIC_OSTEOUPGRADE_URL || 'https://osteo-upgrade.fr'

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

/* ── Revue de littérature (colonne gauche) ── */
export function ReviewWidget({
  review,
  loading,
  onRefresh,
}: {
  review: LiteratureReview | null
  loading: boolean
  onRefresh: () => void
}) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <Card className="border-border/30 h-full flex flex-col">
      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between shrink-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <BookOpen className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-emerald-600 dark:text-emerald-400">Revue de littérature</span>
        </CardTitle>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent transition-colors"
        >
          <RefreshCw className={`h-3 w-3 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
        </button>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex-1 flex flex-col justify-center">
        {loading ? (
          <div className="space-y-2">
            <div className="h-24 bg-muted/40 rounded animate-pulse mb-2" />
            <div className="h-4 bg-muted/50 rounded animate-pulse" />
            <div className="h-3 bg-muted/40 rounded animate-pulse w-3/4" />
            <div className="h-3 bg-muted/40 rounded animate-pulse w-1/2" />
          </div>
        ) : review ? (
          <>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="group flex flex-col gap-1.5 text-left"
            >
              {review.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={review.image_url}
                  alt={review.title}
                  className="w-full h-24 object-cover rounded-md"
                />
              )}
              <p className="text-sm font-medium leading-snug group-hover:text-primary transition-colors line-clamp-2">
                {review.title}
              </p>
              {review.published_date && (
                <Badge variant="outline" className="text-xs w-fit">
                  {new Date(review.published_date).toLocaleDateString('fr-FR', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </Badge>
              )}
              {review.summary && (
                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                  {review.summary}
                </p>
              )}
              <span className="text-xs text-primary flex items-center gap-1 pt-1">
                Lire l&apos;article <ChevronRight className="h-3 w-3" />
              </span>
            </button>
            <LiteratureReviewModal
              reviewId={review.id}
              open={modalOpen}
              onOpenChange={setModalOpen}
            />
          </>
        ) : (
          <p className="text-xs text-muted-foreground py-2">Aucun article disponible</p>
        )}
      </CardContent>
    </Card>
  )
}

/* ── Formation mise en avant avec progression (colonne droite) ── */
export function FeaturedFormationWidget({
  formation,
  loading,
  practitionerEmail,
}: {
  formation: FeaturedFormation | null
  loading: boolean
  practitionerEmail: string | null
}) {
  const router = useRouter()
  const [progress, setProgress] = useState<{ total: number; completed: number } | null>(null)

  useEffect(() => {
    if (!formation || !practitionerEmail) return
    const params = new URLSearchParams({ formation_id: formation.id, email: practitionerEmail })
    fetch(`/api/osteoupgrade-course-progress?${params}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setProgress({ total: d.total ?? 0, completed: d.completed ?? 0 }))
      .catch(() => {})
  }, [formation?.id, practitionerEmail])

  const pct = progress && progress.total > 0
    ? Math.round((progress.completed / progress.total) * 100)
    : null

  return (
    <Card className="border-violet-200 bg-violet-50/30 dark:border-violet-900/50 dark:bg-violet-950/10 h-full flex flex-col">
      <CardHeader className="pb-2 pt-4 px-4 shrink-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-violet-500 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-violet-600 dark:text-violet-400">Nouveauté OsteoUpgrade</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex-1 flex flex-col justify-center">
        {loading ? (
          <div className="space-y-2">
            <div className="h-24 bg-muted/40 rounded animate-pulse mb-2" />
            <div className="h-4 bg-muted/50 rounded animate-pulse" />
            <div className="h-3 bg-muted/40 rounded animate-pulse w-2/3" />
          </div>
        ) : formation ? (
          <div className="flex flex-col gap-3">
            {formation.photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={formation.photo_url}
                alt={formation.title}
                className="w-full h-24 object-cover rounded-md"
              />
            )}
            <div>
              <p className="text-sm font-medium leading-snug line-clamp-2">{formation.title}</p>
              {formation.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {stripHtml(formation.description)}
                </p>
              )}
            </div>

            {/* Mini progress bar */}
            {pct !== null && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{progress!.completed}/{progress!.total} modules</span>
                  <span className={`font-semibold ${pct === 100 ? 'text-emerald-600' : 'text-violet-600'}`}>{pct}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-violet-100 dark:bg-violet-900/30 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${pct === 100 ? 'bg-emerald-500' : 'bg-violet-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {pct === 100 && (
                  <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                    <Trophy className="h-3 w-3" /> Formation terminée !
                  </p>
                )}
              </div>
            )}

            {/* Accéder au cours */}
            <button
              type="button"
              onClick={() => router.push(`/formation/${formation.id}`)}
              className="w-full flex items-center gap-2 rounded-lg border border-violet-200 dark:border-violet-800 bg-white/60 dark:bg-violet-950/20 px-3 py-2 text-left hover:bg-violet-50 dark:hover:bg-violet-950/40 hover:border-violet-300 transition-colors group"
            >
              <PlayCircle className="h-4 w-4 text-violet-400 flex-shrink-0 group-hover:text-violet-600" />
              <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
                {pct !== null && pct > 0 ? 'Reprendre le cours' : 'Accéder au cours'}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-violet-400 ml-auto group-hover:text-violet-600" />
            </button>
          </div>
        ) : (
          <a
            href={`${OSTEOUPGRADE_URL}/elearning/cours`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col items-center justify-center gap-2 py-6 text-center"
          >
            <GraduationCap className="h-8 w-8 text-violet-300" />
            <p className="text-xs text-muted-foreground">
              Découvrez les formations sur OsteoUpgrade
            </p>
            <span className="text-xs text-violet-600 flex items-center gap-1">
              Voir le catalogue <ExternalLink className="h-2.5 w-2.5" />
            </span>
          </a>
        )}
      </CardContent>
    </Card>
  )
}
