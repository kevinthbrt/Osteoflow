'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  BookOpen,
  GraduationCap,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  Trophy,
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

type SubpartProgress = {
  id: string
  title: string
  order_index: number
  completed: boolean
}

type ChapterProgress = {
  id: string
  title: string
  order_index: number
  subparts: SubpartProgress[]
}

type CourseProgressData = {
  total: number
  completed: number
  chapters: ChapterProgress[] | null
}

const OSTEOUPGRADE_URL = process.env.NEXT_PUBLIC_OSTEOUPGRADE_URL || 'https://osteo-upgrade.fr'

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

/* ── Modal de progression du cours ── */
function CourseProgressModal({
  open,
  onClose,
  formation,
  practitionerEmail,
}: {
  open: boolean
  onClose: () => void
  formation: FeaturedFormation
  practitionerEmail: string | null
}) {
  const [progress, setProgress] = useState<CourseProgressData | null>(null)
  const [loading, setLoading] = useState(false)
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>({})

  // Fetch on open
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) { onClose(); return }
    if (!practitionerEmail) return
    setLoading(true)
    const params = new URLSearchParams({ formation_id: formation.id, email: practitionerEmail })
    fetch(`/api/osteoupgrade-course-progress?${params}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setProgress(d)
        // open all chapters by default
        if (d.chapters) {
          const initial: Record<string, boolean> = {}
          for (const c of d.chapters) initial[c.id] = true
          setOpenChapters(initial)
        }
      })
      .catch(() => setProgress(null))
      .finally(() => setLoading(false))
  }

  const pct = progress && progress.total > 0
    ? Math.round((progress.completed / progress.total) * 100)
    : 0

  const toggleChapter = (id: string) =>
    setOpenChapters((prev) => ({ ...prev, [id]: !prev[id] }))

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-violet-500 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="h-3.5 w-3.5 text-white" />
            </div>
            {formation.title}
          </DialogTitle>
        </DialogHeader>

        {/* Progress header */}
        {progress && progress.total > 0 && (
          <div className="flex-shrink-0 space-y-2 pb-3 border-b border-border/40">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {progress.completed} / {progress.total} modules complétés
              </span>
              <span className={`font-semibold ${pct === 100 ? 'text-emerald-600' : 'text-violet-600'}`}>
                {pct}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${pct === 100 ? 'bg-emerald-500' : 'bg-violet-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {pct === 100 && (
              <div className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
                <Trophy className="h-4 w-4" />
                Formation terminée !
              </div>
            )}
          </div>
        )}

        {/* Chapter list */}
        <div className="flex-1 overflow-y-auto space-y-2 py-1">
          {loading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2 animate-pulse">
                  <div className="h-4 bg-muted/40 rounded w-1/3" />
                  <div className="ml-4 space-y-1.5">
                    <div className="h-3 bg-muted/30 rounded w-3/4" />
                    <div className="h-3 bg-muted/30 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : !progress?.chapters?.length ? (
            <div className="py-8 text-center">
              <GraduationCap className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {!practitionerEmail
                  ? 'Email praticien non disponible'
                  : 'Aucun contenu trouvé pour ce cours'}
              </p>
            </div>
          ) : (
            progress.chapters.map((chapter) => {
              const chapterCompleted = chapter.subparts?.filter((s) => s.completed).length ?? 0
              const chapterTotal = chapter.subparts?.length ?? 0
              const isOpen = openChapters[chapter.id] ?? true
              return (
                <div key={chapter.id} className="rounded-lg border border-border/40 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleChapter(chapter.id)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-accent/40 transition-colors"
                  >
                    {isOpen
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    }
                    <span className="text-sm font-medium flex-1">{chapter.title}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">
                      {chapterCompleted}/{chapterTotal}
                    </span>
                  </button>
                  {isOpen && chapter.subparts && (
                    <div className="border-t border-border/20 divide-y divide-border/20">
                      {chapter.subparts.map((sub) => (
                        <div key={sub.id} className="flex items-center gap-2.5 px-4 py-2">
                          {sub.completed
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                            : <Circle className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                          }
                          <span className={`text-sm ${sub.completed ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {sub.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 pt-3 border-t border-border/40 flex justify-between items-center">
          <p className="text-xs text-muted-foreground">
            Progression synchronisée depuis OsteoUpgrade
          </p>
          <Button variant="outline" size="sm" asChild>
            <a href={`${OSTEOUPGRADE_URL}/elearning/cours`} target="_blank" rel="noopener noreferrer">
              Ouvrir sur OsteoUpgrade
              <ExternalLink className="ml-1.5 h-3 w-3" />
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
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
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
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
              <div className="h-24 bg-muted/40 rounded animate-pulse mb-2" />
              <div className="h-4 bg-muted/50 rounded animate-pulse" />
              <div className="h-3 bg-muted/40 rounded animate-pulse w-2/3" />
            </div>
          ) : formation ? (
            <div className="space-y-3">
              {formation.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={formation.photo_url}
                  alt={formation.title}
                  className="w-full h-24 object-cover rounded-md"
                />
              )}
              <a
                href={`${OSTEOUPGRADE_URL}/elearning/cours`}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                <p className="text-sm font-medium leading-snug group-hover:text-violet-700 transition-colors line-clamp-2">
                  {formation.title}
                </p>
                {formation.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {stripHtml(formation.description)}
                  </p>
                )}
              </a>
              {/* Ma progression */}
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="w-full flex items-center gap-2 rounded-lg border border-violet-200 bg-white/60 px-3 py-2 text-left hover:bg-violet-50 hover:border-violet-300 transition-colors group"
              >
                <GraduationCap className="h-4 w-4 text-violet-400 flex-shrink-0 group-hover:text-violet-600" />
                <span className="text-xs font-medium text-violet-700">Ma progression</span>
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

      {formation && (
        <CourseProgressModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          formation={formation}
          practitionerEmail={practitionerEmail}
        />
      )}
    </>
  )
}
