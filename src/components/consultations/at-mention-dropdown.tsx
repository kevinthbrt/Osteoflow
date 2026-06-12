'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface Item {
  id: string
  name: string
  region?: string | null
  description?: string | null
  use_count?: number
}

type TestResult = 'positive' | 'negative' | 'uncertain'

const RESULT_OPTIONS: { value: TestResult; label: string; symbol: string; cls: string }[] = [
  { value: 'positive', label: 'Positif', symbol: '✅', cls: 'hover:bg-emerald-50 hover:text-emerald-800' },
  { value: 'negative', label: 'Négatif', symbol: '❌', cls: 'hover:bg-rose-50 hover:text-rose-800' },
  { value: 'uncertain', label: 'Incertain', symbol: '❓', cls: 'hover:bg-amber-50 hover:text-amber-800' },
]

const RESULT_LABELS: Record<TestResult, string> = {
  positive: 'Positif',
  negative: 'Négatif',
  uncertain: 'Incertain',
}

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

interface Props {
  items: Item[]
  regionQuery: string
  anchorRef: React.RefObject<HTMLTextAreaElement>
  onSelect: (text: string) => void
  onClose: () => void
  showResultPicker?: boolean
}

export function AtMentionDropdown({ items, regionQuery, anchorRef, onSelect, onClose, showResultPicker = true }: Props) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const [pendingItem, setPendingItem] = useState<Item | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = normalize(regionQuery)
    let result = items
    if (q) {
      result = items.filter(t => {
        const haystack = normalize(t.region ?? '') + ' ' + normalize(t.name)
        return haystack.includes(q)
      })
    }
    return result
      .slice()
      .sort((a, b) => {
        const ucDiff = (b.use_count ?? 0) - (a.use_count ?? 0)
        if (ucDiff !== 0) return ucDiff
        return a.name.localeCompare(b.name)
      })
      .slice(0, 12)
  }, [items, regionQuery])

  // Position dropdown below textarea
  useEffect(() => {
    const el = anchorRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: rect.width,
    })
  }, [anchorRef])

  // Reset active index when filtered changes
  useEffect(() => { setActiveIndex(0) }, [filtered])

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (pendingItem) {
        if (e.key === 'Escape') { setPendingItem(null); e.preventDefault() }
        return
      }
      if (e.key === 'Escape') { onClose(); e.preventDefault() }
      if (e.key === 'ArrowDown') { setActiveIndex(i => Math.min(i + 1, filtered.length - 1)); e.preventDefault() }
      if (e.key === 'ArrowUp') { setActiveIndex(i => Math.max(i - 1, 0)); e.preventDefault() }
      if (e.key === 'Enter' && filtered[activeIndex]) {
        if (showResultPicker) {
          setPendingItem(filtered[activeIndex])
        } else {
          onSelect(filtered[activeIndex].name)
        }
        e.preventDefault()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [filtered, activeIndex, onClose, pendingItem, showResultPicker, onSelect])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  if (!pos) return null

  const handleResult = (item: Item, result: TestResult) => {
    onSelect(`${item.name} : ${RESULT_LABELS[result]}`)
    setPendingItem(null)
  }

  return createPortal(
    <div
      ref={dropdownRef}
      style={{ position: 'absolute', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
      className="bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
    >
      {filtered.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">Aucun résultat pour « {regionQuery} »</p>
      ) : pendingItem ? (
        /* Result picker for selected item */
        <div className="p-2">
          <p className="text-xs font-medium text-muted-foreground px-1 mb-2 truncate">{pendingItem.name}</p>
          <div className="flex gap-1">
            {RESULT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleResult(pendingItem, opt.value)}
                className={`flex-1 flex flex-col items-center gap-0.5 rounded-md py-2 text-xs border border-border transition-colors ${opt.cls}`}
              >
                <span className="text-base">{opt.symbol}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPendingItem(null)}
            className="mt-1 w-full text-xs text-center text-muted-foreground hover:text-foreground py-1"
          >
            ← Retour
          </button>
        </div>
      ) : (
        /* Items list */
        <ul className="max-h-56 overflow-y-auto py-1">
          {filtered.map((t, i) => (
            <li key={t.id}>
              <button
                type="button"
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => {
                  if (showResultPicker) {
                    setPendingItem(t)
                  } else {
                    onSelect(t.name)
                  }
                }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  i === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'
                }`}
              >
                <span className="font-medium">{t.name}</span>
                {t.region && (
                  <span className="ml-2 text-xs text-muted-foreground">{t.region}</span>
                )}
                {t.description && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{t.description}</p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>,
    document.body
  )
}
