'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { PlayCircle, Search, WifiOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { isRecent, type Tutorial } from '@/lib/tutorials/types'
import { useTutorialCatalog } from '@/lib/tutorials/use-tutorials'

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function matches(tutorial: Tutorial, query: string): boolean {
  if (!query) return true
  const haystack = normalize(
    [tutorial.title, tutorial.kicker, tutorial.summary, ...tutorial.steps.map((s) => `${s.title} ${s.text}`)].join(' ')
  )
  return normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word))
}

export default function TutorialsPage() {
  const { catalog, failed } = useTutorialCatalog()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)

  const visible = useMemo(
    () => (catalog?.tutorials ?? []).filter((t) => (!category || t.category === category) && matches(t, query.trim())),
    [catalog, category, query]
  )
  const sections = (catalog?.categories ?? [])
    .map((c) => ({ ...c, tutorials: visible.filter((t) => t.category === c.id) }))
    .filter((c) => c.tutorials.length > 0)

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tutoriels</h1>
          <p className="mt-1 text-muted-foreground">
            Chaque fonction de MyOsteoflow en courte vidéo, puis pas à pas.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher : facture, dictée, Doctolib…"
            className="pl-9"
            aria-label="Rechercher un tutoriel"
          />
        </div>
      </div>

      {catalog && catalog.categories.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Rubriques">
          {[{ id: null as string | null, label: 'Tout' }, ...catalog.categories].map((c) => (
            <button
              key={c.id ?? 'all'}
              role="tab"
              aria-selected={category === c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                category === c.id
                  ? 'border-accent-foreground/30 bg-accent text-accent-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {catalog?.source === 'bundled' && (
        <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          <WifiOff className="h-4 w-4 shrink-0" />
          Hors connexion : la liste peut ne pas être à jour, et les vidéos demandent une connexion internet.
        </p>
      )}

      {!catalog && !failed && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
          ))}
        </div>
      )}

      {failed && <p className="text-sm text-muted-foreground">Les tutoriels n’ont pas pu être chargés. Réessayez dans un instant.</p>}

      {catalog && sections.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">Aucun tutoriel ne correspond à « {query} ».</p>
      )}

      {sections.map((section) => (
        <section key={section.id} className="space-y-3" aria-labelledby={`rubrique-${section.id}`}>
          <h2 id={`rubrique-${section.id}`} className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {section.label}
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {section.tutorials.map((tutorial) => (
              <TutorialCard key={tutorial.slug} tutorial={tutorial} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function TutorialCard({ tutorial }: { tutorial: Tutorial }) {
  return (
    <Link
      href={`/tutorials/${tutorial.slug}`}
      className="group overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-video bg-slate-900">
        {tutorial.poster && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tutorial.poster} alt="" className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100" loading="lazy" />
        )}
        <span className="absolute inset-0 flex items-center justify-center">
          <PlayCircle className="h-12 w-12 text-white drop-shadow-lg transition-transform group-hover:scale-110" />
        </span>
        {tutorial.duration && (
          <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">{tutorial.duration}</span>
        )}
        {isRecent(tutorial.addedAt) && (
          <span className="absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white">Nouveau</span>
        )}
      </div>
      <div className="space-y-1 p-4">
        {tutorial.kicker && <p className="text-xs font-semibold uppercase tracking-wide text-accent-foreground">{tutorial.kicker}</p>}
        <h3 className="font-semibold leading-snug">{tutorial.title}</h3>
        {tutorial.summary && <p className="text-sm text-muted-foreground">{tutorial.summary}</p>}
      </div>
    </Link>
  )
}
