'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, ExternalLink, WifiOff } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useTutorialCatalog } from '@/lib/tutorials/use-tutorials'

export default function TutorialPage() {
  const { slug } = useParams<{ slug: string }>()
  const { catalog, failed } = useTutorialCatalog()
  const [videoFailed, setVideoFailed] = useState(false)
  const tutorial = catalog?.tutorials.find((t) => t.slug === slug)

  const back = (
    <Link href="/tutorials" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" />
      Tous les tutoriels
    </Link>
  )

  if (!catalog) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        {back}
        {failed ? (
          <p className="text-sm text-muted-foreground">Ce tutoriel n’a pas pu être chargé. Réessayez dans un instant.</p>
        ) : (
          <Skeleton className="aspect-video rounded-xl" />
        )}
      </div>
    )
  }

  if (!tutorial) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        {back}
        <p className="text-sm text-muted-foreground">Ce tutoriel n’existe pas ou n’est plus disponible.</p>
      </div>
    )
  }

  const others = catalog.tutorials.filter((t) => t.slug !== tutorial.slug && t.category === tutorial.category).slice(0, 3)

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-3">
        {back}
        {tutorial.kicker && <p className="text-xs font-semibold uppercase tracking-wide text-accent-foreground">{tutorial.kicker}</p>}
        <h1 className="text-2xl font-bold tracking-tight">{tutorial.title}</h1>
        {tutorial.intro && <p className="text-muted-foreground">{tutorial.intro}</p>}
      </div>

      {tutorial.video && (
        <div className="overflow-hidden rounded-xl bg-slate-900 shadow-sm">
          {videoFailed ? (
            <div className="flex aspect-video flex-col items-center justify-center gap-2 p-6 text-center text-sm text-slate-300">
              <WifiOff className="h-6 w-6" />
              La vidéo demande une connexion internet. Les étapes ci-dessous restent lisibles.
            </div>
          ) : (
            <video
              key={tutorial.video}
              src={tutorial.video}
              poster={tutorial.poster ?? undefined}
              controls
              playsInline
              preload="metadata"
              onError={() => setVideoFailed(true)}
              className="aspect-video w-full object-contain"
            />
          )}
        </div>
      )}

      {tutorial.availability && (
        <p className="rounded-lg bg-accent/60 px-4 py-3 text-sm text-accent-foreground">{tutorial.availability}</p>
      )}

      {tutorial.steps.length > 0 && (
        <section className="space-y-4" aria-labelledby="etapes">
          <h2 id="etapes" className="text-lg font-semibold">Pas à pas</h2>
          <ol className="space-y-6">
            {tutorial.steps.map((step, index) => (
              <li key={index} className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-start">
                <div className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold leading-snug">{step.title}</h3>
                    {step.text && <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>}
                  </div>
                </div>
                {step.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={step.image}
                    alt=""
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                    className="w-full rounded-lg border border-border shadow-sm"
                  />
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {tutorial.faq.length > 0 && (
        <section className="space-y-3" aria-labelledby="questions">
          <h2 id="questions" className="text-lg font-semibold">Questions fréquentes</h2>
          <div className="divide-y divide-border rounded-xl border border-border">
            {tutorial.faq.map((item, index) => (
              <details key={index} className="group px-4 py-3">
                <summary className="cursor-pointer list-none font-medium marker:hidden">{item.q}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
        {tutorial.page && (
          <a href={tutorial.page} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-foreground hover:underline">
            Ouvrir sur le site, pour le partager
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {others.length > 0 && (
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="text-muted-foreground">Dans la même rubrique :</span>
            {others.map((other) => (
              <Link key={other.slug} href={`/tutorials/${other.slug}`} className="font-medium text-accent-foreground hover:underline">
                {other.kicker || other.title}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
