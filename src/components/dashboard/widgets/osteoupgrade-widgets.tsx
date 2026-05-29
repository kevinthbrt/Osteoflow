'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BookOpen, GraduationCap, ExternalLink, RefreshCw } from 'lucide-react'

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
  return (
    <Card className="border-border/30 h-full">
      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <BookOpen className="h-3.5 w-3.5 text-white" />
          </div>
          Revue de littérature
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-24 bg-muted/40 rounded animate-pulse mb-2" />
            <div className="h-4 bg-muted/50 rounded animate-pulse" />
            <div className="h-3 bg-muted/40 rounded animate-pulse w-3/4" />
            <div className="h-3 bg-muted/40 rounded animate-pulse w-1/2" />
          </div>
        ) : review ? (
          <a
            href={`${OSTEOUPGRADE_URL}/elearning/revue-litterature`}
            target="_blank"
            rel="noopener noreferrer"
            className="group block space-y-1.5"
          >
            {review.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={review.image_url}
                alt={review.title}
                className="w-full h-24 object-cover rounded-md mb-2"
              />
            )}
            <p className="text-sm font-medium leading-snug group-hover:text-primary transition-colors line-clamp-2">
              {review.title}
            </p>
            {review.published_date && (
              <Badge variant="outline" className="text-xs">
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
            <span className="text-xs text-primary flex items-center gap-1 mt-1">
              Lire sur OsteoUpgrade <ExternalLink className="h-2.5 w-2.5" />
            </span>
          </a>
        ) : (
          <p className="text-xs text-muted-foreground py-2">Aucun article disponible</p>
        )}
      </CardContent>
    </Card>
  )
}

/* ── Nouveauté / formation mise en avant (colonne droite) ── */
export function FeaturedFormationWidget({
  formation,
  loading,
}: {
  formation: FeaturedFormation | null
  loading: boolean
}) {
  return (
    <Card className="border-violet-200 bg-violet-50/30 h-full">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-violet-500 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="h-3.5 w-3.5 text-white" />
          </div>
          Nouveauté OsteoUpgrade
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-20 bg-muted/40 rounded animate-pulse mb-2" />
            <div className="h-4 bg-muted/50 rounded animate-pulse" />
            <div className="h-3 bg-muted/40 rounded animate-pulse w-2/3" />
          </div>
        ) : formation ? (
          <a
            href={`${OSTEOUPGRADE_URL}/elearning/cours`}
            target="_blank"
            rel="noopener noreferrer"
            className="group block space-y-2"
          >
            {formation.photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={formation.photo_url}
                alt={formation.title}
                className="w-full h-24 object-cover rounded-md"
              />
            )}
            <p className="text-sm font-medium leading-snug group-hover:text-violet-700 transition-colors line-clamp-2">
              {formation.title}
            </p>
            {formation.description && (
              <p className="text-xs text-muted-foreground line-clamp-3">
                {stripHtml(formation.description)}
              </p>
            )}
            <span className="text-xs text-violet-600 flex items-center gap-1">
              Découvrir <ExternalLink className="h-2.5 w-2.5" />
            </span>
          </a>
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
