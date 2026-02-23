'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, Bug, Zap, ArrowRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { changelog } from '@/data/changelog'
import packageJson from '../../../package.json'

const LAST_SEEN_KEY = 'osteoflow_last_seen_version'

const typeConfig = {
  feature: { icon: Sparkles, label: 'Nouveau', className: 'bg-emerald-100 text-emerald-700' },
  fix: { icon: Bug, label: 'Correctif', className: 'bg-red-100 text-red-700' },
  improvement: { icon: Zap, label: 'Amélioration', className: 'bg-blue-100 text-blue-700' },
} as const

export function WhatsNewDialog() {
  const [open, setOpen] = useState(false)
  const currentVersion = packageJson.version

  useEffect(() => {
    const lastSeen = localStorage.getItem(LAST_SEEN_KEY)
    if (lastSeen !== currentVersion) {
      // Find the current version in the changelog
      const entry = changelog.find((e) => e.version === currentVersion)
      if (entry) {
        setOpen(true)
      }
      // Always mark as seen to avoid showing again
      localStorage.setItem(LAST_SEEN_KEY, currentVersion)
    }
  }, [currentVersion])

  const entry = changelog.find((e) => e.version === currentVersion)
  if (!entry) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            Quoi de neuf ?
          </DialogTitle>
          <DialogDescription>
            Version {entry.version} — {entry.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {entry.changes.map((change, i) => {
            const config = typeConfig[change.type]
            const Icon = config.icon
            return (
              <div key={i} className="flex items-start gap-3">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 mt-0.5 ${config.className}`}>
                  <Icon className="h-3 w-3" />
                  {config.label}
                </span>
                <p className="text-sm text-foreground">{change.text}</p>
              </div>
            )
          })}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/changelog" onClick={() => setOpen(false)}>
              Voir tout le changelog
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button size="sm" onClick={() => setOpen(false)}>
            Compris
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
