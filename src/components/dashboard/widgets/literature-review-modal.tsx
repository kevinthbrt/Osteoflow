'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { MarkdownContent } from './markdown-content'
import { TrustScore } from './trust-score'
import { Calendar, ExternalLink, Loader2 } from 'lucide-react'

const OSTEOUPGRADE_URL = process.env.NEXT_PUBLIC_OSTEOUPGRADE_URL || 'https://osteo-upgrade.fr'

type ReviewImage = { url: string; position: string; caption?: string }
type StructuredContent = {
  introduction?: string
  contexte?: string
  methodologie?: string
  resultats?: string
  implications?: string
  conclusion?: string
  points_cles?: string[]
}
type ReviewTag = { id: string; name: string; slug: string; color: string }
type FullReview = {
  id: string
  title: string
  summary: string | null
  content_structured?: StructuredContent | null
  images?: ReviewImage[]
  study_url?: string | null
  published_date: string | null
  thrust_score?: 'A' | 'B' | 'C' | 'D' | 'E' | null
  thrust_score_explanation?: string | null
  tags?: ReviewTag[]
}

export function LiteratureReviewModal({
  reviewId,
  open,
  onOpenChange,
}: {
  reviewId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [review, setReview] = useState<FullReview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!open || !reviewId) return
    setLoading(true)
    setError(false)
    setReview(null)
    fetch(`/api/osteoupgrade-literature-review/${reviewId}`, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error('not ok')
        return r.json()
      })
      .then((d) => setReview(d.review))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [open, reviewId])

  const content = review?.content_structured
  const heroImage = review?.images?.find((img) => img.position === 'hero')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6">
            {review ? review.title : 'Revue de littérature'}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && error && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Impossible de charger l&apos;article. Réessayez plus tard.
          </p>
        )}

        {!loading && !error && review && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              {review.published_date && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(review.published_date).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              )}
              {review.tags?.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  style={{ borderColor: tag.color, color: tag.color }}
                  className="text-xs"
                >
                  {tag.name}
                </Badge>
              ))}
            </div>

            {heroImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={heroImage.url}
                alt={review.title}
                className="w-full max-h-72 object-cover rounded-lg"
              />
            )}

            {review.summary && (
              <div className="border-l-4 border-primary/40 pl-4 py-1 bg-primary/5 rounded-r-lg">
                <MarkdownContent content={review.summary} className="text-sm" />
              </div>
            )}

            <div className="space-y-5 text-sm">
              {content?.introduction && <MarkdownContent content={content.introduction} />}

              {content?.contexte && (
                <div>
                  <h4 className="font-semibold mb-1.5">Contexte</h4>
                  <MarkdownContent content={content.contexte} />
                </div>
              )}

              {content?.methodologie && (
                <div className="bg-muted/40 rounded-lg p-4">
                  <h4 className="font-semibold mb-1.5">Méthodologie</h4>
                  <MarkdownContent content={content.methodologie} />
                </div>
              )}

              {content?.resultats && (
                <div>
                  <h4 className="font-semibold mb-1.5">Résultats</h4>
                  <MarkdownContent content={content.resultats} />
                </div>
              )}

              {content?.implications && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <h4 className="font-semibold mb-1.5">💡 Implications cliniques</h4>
                  <MarkdownContent content={content.implications} />
                </div>
              )}

              {content?.points_cles && content.points_cles.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Points clés à retenir</h4>
                  <ul className="space-y-2">
                    {content.points_cles.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-xs mt-0.5">
                          {idx + 1}
                        </span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {content?.conclusion && (
                <div>
                  <h4 className="font-semibold mb-1.5">Conclusion</h4>
                  <MarkdownContent content={content.conclusion} />
                </div>
              )}
            </div>

            {review.thrust_score && (
              <div>
                <h4 className="font-semibold mb-2 text-sm">Indice de confiance</h4>
                <TrustScore score={review.thrust_score} explanation={review.thrust_score_explanation} />
              </div>
            )}

            {review.study_url && (
              <a
                href={review.study_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Lire l&apos;étude originale
              </a>
            )}

            <a
              href={`${OSTEOUPGRADE_URL}/elearning/revue-litterature/${review.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-muted-foreground hover:text-primary hover:underline"
            >
              Voir sur OsteoUpgrade <ExternalLink className="inline h-2.5 w-2.5" />
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
