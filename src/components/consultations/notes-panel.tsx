'use client'

import { useState } from 'react'
import type { BodyMarker, ConsultationNotesStructured, NoteEntry, NoteSection } from '@/types/database'
import { NOTE_SECTION_LABELS, NOTE_SECTION_ORDER, painColor } from '@/lib/consultation-annotations'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Check, X } from 'lucide-react'

const QUICK_CHIPS: Record<NoteSection, string[]> = {
  anamnesis: [
    'Douleur aiguë',
    'Récidive',
    'Post-traumatique',
    'Sédentaire',
    'Stress',
    'Mauvais sommeil',
    'Port de charges',
  ],
  examination: [],
  treatment: [],
  advice: [],
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

interface NotesPanelProps {
  notes: ConsultationNotesStructured
  section: NoteSection
  onSectionChange: (s: NoteSection) => void
  onAddEntry: (section: NoteSection, entry: NoteEntry) => void
  onRemoveEntry: (section: NoteSection, id: string) => void
  selectedMarker: BodyMarker | null
}

export function NotesPanel({
  notes,
  section,
  onSectionChange,
  onAddEntry,
  onRemoveEntry,
  selectedMarker,
}: NotesPanelProps) {
  const [draft, setDraft] = useState('')

  const addNote = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const entry: NoteEntry = {
      id: crypto.randomUUID(),
      text: trimmed,
      createdAt: new Date().toISOString(),
      markerId: selectedMarker?.id,
      markerLabel: selectedMarker?.label,
      markerEva: selectedMarker?.eva,
    }
    onAddEntry(section, entry)
    setDraft('')
  }

  const currentEntries = notes[section]

  return (
    <div className="space-y-3">
      {/* Stepper */}
      <div className="rounded-xl border bg-card p-1.5">
        {NOTE_SECTION_ORDER.map((s, idx) => {
          const count = notes[s].length
          const active = s === section
          const done = count > 0 && !active
          return (
            <button
              key={s}
              type="button"
              onClick={() => onSectionChange(s)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition ${
                active
                  ? 'bg-primary/10 border border-primary/30'
                  : 'border border-transparent hover:bg-muted/60'
              }`}
            >
              <div
                className={`grid h-6 w-6 place-items-center rounded-md font-mono text-[10px] font-bold ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : done
                      ? 'bg-emerald-500 text-white'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {done ? <Check className="h-3 w-3" /> : String(idx + 1).padStart(2, '0')}
              </div>
              <span className="flex-1 text-sm font-medium">{NOTE_SECTION_LABELS[s]}</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {count > 0 ? `${count} note${count > 1 ? 's' : ''}` : '—'}
              </span>
            </button>
          )
        })}
      </div>

      {/* Current section entries */}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {NOTE_SECTION_LABELS[section]}
          </h3>
          <span className="text-[11px] text-muted-foreground">
            {currentEntries.length} entrée{currentEntries.length > 1 ? 's' : ''}
          </span>
        </div>

        <div className="space-y-2">
          {currentEntries.length === 0 ? (
            <div className="rounded-lg border border-dashed p-5 text-center text-xs italic text-muted-foreground">
              Aucune note. Ajoutez des observations ci-dessous.
            </div>
          ) : (
            currentEntries.map((n) => (
              <div key={n.id} className="group relative rounded-lg border bg-muted/40 px-3 py-2.5 text-sm leading-relaxed">
                <div className="mb-1 flex items-center gap-2">
                  {n.markerLabel && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border bg-background px-1.5 py-0.5 font-mono text-[10px] font-semibold"
                      style={{
                        color: n.markerEva != null ? painColor(n.markerEva) : undefined,
                        borderColor: n.markerEva != null ? painColor(n.markerEva) : undefined,
                      }}
                    >
                      ● {n.markerLabel}
                      {n.markerEva != null && <span>· {n.markerEva}/10</span>}
                    </span>
                  )}
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                    {formatTime(n.createdAt)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveEntry(section, n.id)}
                    className="opacity-0 transition group-hover:opacity-100"
                    aria-label="Supprimer"
                  >
                    <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
                <div className="whitespace-pre-wrap">{n.text}</div>
              </div>
            ))
          )}
        </div>

        {/* Quick chips — only shown for sections that have suggestions */}
        {QUICK_CHIPS[section].length > 0 && (
          <div className="mt-4 space-y-2">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Insertion rapide
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_CHIPS[section].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => addNote(c)}
                  className="rounded-full border bg-background px-2.5 py-1 text-[11px] font-medium transition hover:border-primary/60 hover:text-primary"
                >
                  + {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Add input */}
        <div className="mt-3 space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Nouvelle observation — ${NOTE_SECTION_LABELS[section].toLowerCase()}...`}
            rows={2}
            className="resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                addNote(draft)
              }
            }}
          />
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground">⌘↵ pour ajouter</span>
            {selectedMarker && (
              <span
                className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[10px] font-medium"
                style={{ borderColor: painColor(selectedMarker.eva), color: painColor(selectedMarker.eva) }}
              >
                liée à {selectedMarker.label}
              </span>
            )}
            <Button
              type="button"
              size="sm"
              className="ml-auto h-8"
              onClick={() => addNote(draft)}
              disabled={!draft.trim()}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Ajouter
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
