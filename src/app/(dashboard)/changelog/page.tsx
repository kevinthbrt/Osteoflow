'use client'

import { Sparkles, Bug, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { changelog } from '@/data/changelog'
import packageJson from '../../../../package.json'

const typeConfig = {
  feature: { icon: Sparkles, label: 'Nouveau', className: 'bg-emerald-100 text-emerald-700' },
  fix: { icon: Bug, label: 'Correctif', className: 'bg-red-100 text-red-700' },
  improvement: { icon: Zap, label: 'Amélioration', className: 'bg-blue-100 text-blue-700' },
} as const

export default function ChangelogPage() {
  const currentVersion = packageJson.version

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Changelog</h1>
        <p className="text-muted-foreground mt-1">
          Historique des mises à jour et améliorations d&apos;Osteoflow
        </p>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[17px] top-8 bottom-8 w-px bg-border" />

        <div className="space-y-6">
          {changelog.map((entry, index) => {
            const isCurrent = entry.version === currentVersion
            return (
              <div key={entry.version} className="relative flex gap-4">
                {/* Timeline dot */}
                <div className="relative z-10 mt-5 shrink-0">
                  <div className={`w-[9px] h-[9px] rounded-full ring-4 ring-background ${
                    index === 0 ? 'bg-indigo-500' : 'bg-muted-foreground/30'
                  }`} />
                </div>

                <Card className={`flex-1 ${isCurrent ? 'ring-2 ring-indigo-500/20' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        v{entry.version}
                        {isCurrent && (
                          <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                            Version actuelle
                          </span>
                        )}
                      </CardTitle>
                      <span className="text-xs text-muted-foreground">{entry.date}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{entry.title}</p>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    {entry.changes.map((change, i) => {
                      const config = typeConfig[change.type]
                      const Icon = config.icon
                      return (
                        <div key={i} className="flex items-start gap-2.5">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 mt-0.5 ${config.className}`}>
                            <Icon className="h-3 w-3" />
                            {config.label}
                          </span>
                          <p className="text-sm">{change.text}</p>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
