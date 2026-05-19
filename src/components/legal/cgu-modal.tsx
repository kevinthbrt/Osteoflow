'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileText, Shield, CheckCircle2 } from 'lucide-react'
import {
  CGU_SECTIONS,
  PRIVACY_SECTIONS,
  CGU_VERSION,
  CGU_DATE,
  type LegalSection,
} from '@/lib/legal/documents'

function renderInline(text: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-foreground">
        {part}
      </strong>
    ) : (
      part
    )
  )
}

function LegalContent({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="space-y-2">
      {sections.map((s, i) => {
        switch (s.type) {
          case 'h1':
            return (
              <h1 key={i} className="text-lg font-bold text-foreground pt-2">
                {s.content}
              </h1>
            )
          case 'h2':
            return (
              <h2
                key={i}
                className="text-sm font-semibold text-foreground border-b pb-1 mt-5 mb-1"
              >
                {s.content}
              </h2>
            )
          case 'h3':
            return (
              <h3 key={i} className="text-sm font-medium text-foreground mt-3 mb-0.5">
                {s.content}
              </h3>
            )
          case 'p':
            return (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                {renderInline(s.content ?? '')}
              </p>
            )
          case 'ul':
            return (
              <ul key={i} className="list-disc list-inside space-y-1 pl-2">
                {s.items?.map((item, j) => (
                  <li key={j} className="text-sm text-muted-foreground leading-relaxed">
                    {renderInline(item)}
                  </li>
                ))}
              </ul>
            )
          case 'table':
            return (
              <div key={i} className="overflow-x-auto my-2">
                <table className="w-full text-xs border-collapse border border-border">
                  <thead className="bg-muted">
                    <tr>
                      {s.headers?.map((h, j) => (
                        <th key={j} className="border border-border px-2 py-1 text-left font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.rows?.map((row, j) => (
                      <tr key={j}>
                        {row.map((cell, k) => (
                          <td key={k} className="border border-border px-2 py-1 text-muted-foreground">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'hr':
            return <hr key={i} className="my-3 border-border" />
          default:
            return null
        }
      })}
    </div>
  )
}

export function CguModal() {
  const [open, setOpen] = useState(false)
  const [scrolledToBottom, setScrolledToBottom] = useState(false)
  const [isAccepting, setIsAccepting] = useState(false)
  const [activeTab, setActiveTab] = useState('cgu')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/legal/status')
      .then((r) => r.json())
      .then((d) => {
        if (!d.accepted) setOpen(true)
      })
      .catch(() => {})
  }, [])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 60) {
      setScrolledToBottom(true)
    }
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setScrolledToBottom(false)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }

  const handleAccept = async () => {
    setIsAccepting(true)
    try {
      await fetch('/api/legal/accept', { method: 'POST' })
      setOpen(false)
    } catch {
      // silent — user can retry
    } finally {
      setIsAccepting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-2xl h-[88vh] flex flex-col gap-0 p-0 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="text-xl flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Conditions d&apos;utilisation — MyOsteoFlow
          </DialogTitle>
          <DialogDescription>
            Version {CGU_VERSION} · {CGU_DATE} — Veuillez lire et accepter avant de continuer.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="px-6 pt-3 shrink-0">
            <TabsList className="w-fit">
              <TabsTrigger value="cgu" className="gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" />
                CGU
              </TabsTrigger>
              <TabsTrigger value="privacy" className="gap-1.5 text-xs">
                <Shield className="h-3.5 w-3.5" />
                Confidentialité
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="cgu" className="flex-1 min-h-0 mt-3 px-6 overflow-hidden">
            <div
              ref={activeTab === 'cgu' ? scrollRef : undefined}
              className="h-full overflow-y-auto pr-1 pb-4"
              onScroll={handleScroll}
            >
              <LegalContent sections={CGU_SECTIONS} />
            </div>
          </TabsContent>

          <TabsContent value="privacy" className="flex-1 min-h-0 mt-3 px-6 overflow-hidden">
            <div
              ref={activeTab === 'privacy' ? scrollRef : undefined}
              className="h-full overflow-y-auto pr-1 pb-4"
              onScroll={handleScroll}
            >
              <LegalContent sections={PRIVACY_SECTIONS} />
            </div>
          </TabsContent>
        </Tabs>

        <div className="px-6 py-4 border-t shrink-0 flex items-center justify-between gap-4 bg-muted/30">
          {scrolledToBottom ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
              Lu jusqu&apos;en bas. Vous pouvez accepter.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Faites défiler jusqu&apos;en bas pour activer le bouton d&apos;acceptation.
            </p>
          )}
          <Button
            onClick={handleAccept}
            disabled={!scrolledToBottom || isAccepting}
            className="shrink-0"
          >
            {isAccepting ? 'Enregistrement…' : "J'accepte"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
