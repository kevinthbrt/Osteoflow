'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export interface NavSection {
  id: string
  label: string
}

/**
 * Barre de navigation ancrée (sticky) pour la page de consultation : des pastilles
 * qui défilent vers chaque section, avec « scroll-spy » (la section visible est
 * mise en évidence). Coexiste avec la colonne patient à gauche.
 */
export function ConsultationNav({ sections }: { sections: NavSection[] }) {
  const [active, setActive] = useState(sections[0]?.id)

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => !!el)
    if (els.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      // La section est « active » quand elle est dans le tiers haut du viewport.
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 },
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [sections])

  const goTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav className="sticky top-0 z-20 -mx-1 mb-4 flex gap-1 overflow-x-auto border-b bg-background/85 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {sections.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => goTo(s.id)}
          className={cn(
            'shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors',
            active === s.id
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted',
          )}
        >
          {s.label}
        </button>
      ))}
    </nav>
  )
}
