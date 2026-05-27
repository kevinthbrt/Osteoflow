'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PlayCircle, RefreshCw, Video, X, ExternalLink } from 'lucide-react'

type PracticeVideo = {
  id: string
  title: string
  region: string
  vimeo_id: string | null
  vimeo_url: string | null
  thumbnail_url: string | null
  duration_seconds: number | null
  description: string | null
}

const REGION_LABELS: Record<string, string> = {
  cervical: 'Cervicales',
  thoracique: 'Thoracique',
  lombaire: 'Lombaires',
  epaule: 'Épaule',
  coude: 'Coude',
  poignet: 'Poignet & main',
  bassin: 'Bassin',
  hanche: 'Hanche',
  genou: 'Genou',
  pied_cheville: 'Pied & Cheville',
}

function getEmbedUrl(video: PracticeVideo): string {
  if (video.vimeo_id) return `https://player.vimeo.com/video/${video.vimeo_id}?autoplay=1&title=0&byline=0&portrait=0`
  if (!video.vimeo_url) return ''
  try {
    const parsed = new URL(video.vimeo_url)
    const segments = parsed.pathname.split('/').filter(Boolean)
    const id = segments.pop()
    return id ? `https://player.vimeo.com/video/${id}?autoplay=1&title=0&byline=0&portrait=0` : ''
  } catch {
    return ''
  }
}

function getThumbnail(video: PracticeVideo): string {
  if (video.thumbnail_url) return video.thumbnail_url
  if (video.vimeo_id) return `https://vumbnail.com/${video.vimeo_id}.jpg`
  return ''
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function VideoWidget() {
  const [video, setVideo] = useState<PracticeVideo | null>(null)
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const fetchVideo = useCallback(async () => {
    setLoading(true)
    setPlaying(false)
    try {
      const res = await fetch('/api/practice-video')
      const data = await res.json()
      setVideo(data.video || null)
    } catch {
      setVideo(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchVideo()
  }, [fetchVideo, refreshKey])

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1)
  }

  const embedUrl = video ? getEmbedUrl(video) : ''
  const thumbnail = video ? getThumbnail(video) : ''

  return (
    <Card className="overflow-hidden border-border/30">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
            <Video className="h-4 w-4 text-white" />
          </div>
          Pratique du jour
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={loading} className="h-8 w-8 p-0">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="h-52 bg-muted/40 animate-pulse flex items-center justify-center">
            <Video className="h-10 w-10 text-muted-foreground/30" />
          </div>
        ) : !video ? (
          <div className="h-52 bg-muted/20 flex flex-col items-center justify-center gap-3 px-4 text-center">
            <Video className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Vidéos Osteoupgrade non disponibles
            </p>
            <Button variant="outline" size="sm" asChild>
              <a
                href={process.env.NEXT_PUBLIC_OSTEOUPGRADE_URL || 'https://osteoupgrade.vercel.app'}
                target="_blank"
                rel="noopener noreferrer"
              >
                Accéder à Osteoupgrade
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          </div>
        ) : playing && embedUrl ? (
          <div className="relative">
            <div className="aspect-video bg-black">
              <iframe
                key={video.id}
                src={embedUrl}
                className="w-full h-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                title={video.title}
              />
            </div>
            <button
              onClick={() => setPlaying(false)}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div
            className="relative aspect-video cursor-pointer group overflow-hidden"
            onClick={() => setPlaying(true)}
          >
            {thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnail}
                alt={video.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center">
                <Video className="h-16 w-16 text-muted-foreground/30" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                <PlayCircle className="h-10 w-10 text-white" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-white font-semibold text-sm line-clamp-2 leading-snug">{video.title}</p>
                  <Badge
                    variant="secondary"
                    className="mt-1.5 text-xs bg-white/15 text-white border-white/20 backdrop-blur-sm"
                  >
                    {REGION_LABELS[video.region] || video.region}
                  </Badge>
                </div>
                {video.duration_seconds && (
                  <span className="text-white/70 text-xs flex-shrink-0 tabular-nums">
                    {formatDuration(video.duration_seconds)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        {video && !playing && (
          <div className="px-4 py-3 flex items-center justify-between border-t border-border/20">
            <p className="text-xs text-muted-foreground">Cliquez pour visionner</p>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" asChild>
              <a
                href={process.env.NEXT_PUBLIC_OSTEOUPGRADE_URL || 'https://osteoupgrade.vercel.app'}
                target="_blank"
                rel="noopener noreferrer"
              >
                Voir tout <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
