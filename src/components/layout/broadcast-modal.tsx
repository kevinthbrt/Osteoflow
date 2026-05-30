'use client'

import { useEffect, useState } from 'react'
import { X, Megaphone, Video, ChevronLeft, ChevronRight } from 'lucide-react'

type Broadcast = {
  id: string
  title: string
  body: string
  image_url: string | null
  video_url: string | null
  target: 'osteoflow' | 'osteoupgrade' | 'both'
  created_at: string
}

function isEmbedUrl(url: string) {
  return /youtube\.com|youtu\.be|vimeo\.com/i.test(url)
}

function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) return `https://www.youtube.com/embed/${v}`
    }
    if (u.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed${u.pathname}`
    }
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop()
      if (id) return `https://player.vimeo.com/video/${id}`
    }
  } catch { /* ignore */ }
  return null
}

async function markSeenLocal(ids: string[]) {
  try {
    await fetch('/api/osteoupgrade-broadcast-seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
  } catch { /* silent */ }
}

export function BroadcastModal() {
  const [queue, setQueue] = useState<Broadcast[]>([])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    fetchUnseen()
  }, [])

  const fetchUnseen = async () => {
    try {
      const res = await fetch('/api/osteoupgrade-broadcasts', { cache: 'no-store' })
      if (!res.ok) return
      const { unseen } = await res.json()
      if (unseen?.length) {
        setQueue(unseen)
        setIndex(0)
      }
    } catch { /* silent */ }
  }

  if (queue.length === 0) return null

  const current = queue[index]
  const total = queue.length

  const handleClose = async () => {
    await markSeenLocal(queue.map(b => b.id))
    setQueue([])
  }

  const handleNext = async () => {
    await markSeenLocal([current.id])
    if (index < total - 1) {
      setIndex(i => i + 1)
    } else {
      setQueue([])
    }
  }

  const handlePrev = () => {
    if (index > 0) setIndex(i => i - 1)
  }

  const embedUrl = current.video_url && isEmbedUrl(current.video_url) ? getEmbedUrl(current.video_url) : null
  const isDirectVideo = current.video_url && !isEmbedUrl(current.video_url)

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {current.image_url && !current.video_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.image_url} alt={current.title} className="w-full h-52 object-cover" />
        )}
        {embedUrl && (
          <div className="aspect-video w-full">
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
        {isDirectVideo && (
          <video src={current.video_url!} controls className="w-full max-h-56 object-cover bg-black" />
        )}

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg">
                <Megaphone className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">Annonce</p>
                <h2 className="font-bold text-slate-900 text-lg leading-tight">{current.title}</h2>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{current.body}</p>

          {current.video_url && !embedUrl && !isDirectVideo && (
            <a href={current.video_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-sm text-blue-600 font-medium hover:underline">
              <Video className="h-4 w-4" /> Voir la vidéo
            </a>
          )}
        </div>

        <div className="border-t border-slate-100 px-6 py-4 bg-slate-50 flex items-center justify-between gap-3">
          {total > 1 ? (
            <>
              <div className="flex items-center gap-1.5">
                {queue.map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-blue-500' : 'w-1.5 bg-slate-300'}`} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrev}
                  disabled={index === 0}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow hover:shadow-md transition-all"
                >
                  {index < total - 1 ? 'Suivant' : 'Fermer'}
                  {index < total - 1 && <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={handleClose}
              className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow hover:shadow-md transition-all"
            >
              Compris !
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
