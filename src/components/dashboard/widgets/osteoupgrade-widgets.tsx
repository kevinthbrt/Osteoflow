'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BookOpen, GraduationCap, ExternalLink, RefreshCw } from 'lucide-react'

type LiteratureReview = {
  id: string
  title: string
  summary: string | null
  image_url: string | null
  published_date: string | null
}

type FeaturedFormation = {
  id: string
  title: string
  description: string | null
  photo_url: string | null
}

type WidgetsData = {
  review: LiteratureReview | null
  featured_formation: FeaturedFormation | null
}

const OSTEOUPGRADE_URL = process.env.NEXT_PUBLIC_OSTEOUPGRADE_URL || 'https://osteo-upgrade.fr'

export function OsteoupgradeWidgets() {
  const [data, setData] = useState<WidgetsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setLoading(true)
    fetch('/api/osteoupgrade-widgets')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [refreshKey])

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Random literature review */}
      <Card className="border-border/30 flex-1">
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
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {loading ? (
            <div className="space-y-2">
              <div className="h-4 bg-muted/50 rounded animate-pulse" />
              <div className="h-3 bg-muted/40 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-muted/40 rounded animate-pulse w-1/2" />
            </div>
          ) : data?.review ? (
            <a
              href={`${OSTEOUPGRADE_URL}/elearning/revue-litterature`}
              target="_blank"
              rel="noopener noreferrer"
              className="group block space-y-1.5"
            >
              <p className="text-sm font-medium leading-snug group-hover:text-primary transition-colors line-clamp-2">
                {data.review.title}
              </p>
              {data.review.published_date && (
                <Badge variant="outline" className="text-xs">
                  {new Date(data.review.published_date).toLocaleDateString('fr-FR', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </Badge>
              )}
              {data.review.summary && (
                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                  {data.review.summary}
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

      {/* Featured formation — only shown when set */}
      {!loading && data?.featured_formation && (
        <Card className="border-violet-200 bg-violet-50/30">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-violet-500 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="h-3.5 w-3.5 text-white" />
              </div>
              Nouveauté OsteoUpgrade
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <a
              href={`${OSTEOUPGRADE_URL}/elearning/cours`}
              target="_blank"
              rel="noopener noreferrer"
              className="group block space-y-2"
            >
              {data.featured_formation.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.featured_formation.photo_url}
                  alt={data.featured_formation.title}
                  className="w-full h-20 object-cover rounded-md"
                />
              )}
              <p className="text-sm font-medium leading-snug group-hover:text-violet-700 transition-colors line-clamp-2">
                {data.featured_formation.title}
              </p>
              {data.featured_formation.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {data.featured_formation.description}
                </p>
              )}
              <span className="text-xs text-violet-600 flex items-center gap-1">
                Découvrir <ExternalLink className="h-2.5 w-2.5" />
              </span>
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
