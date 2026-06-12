'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface OrthoTest {
  id: string
  name: string
  region: string | null
  indications: string | null
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
  tests: OrthoTest[]
  regionQuery: string
  anchorRef: React.RefObject<HTMLTextAreaElement>
  onSelect: (text: string) => void
  onClose: () => void
}

export function AtMentionDropdown({ tests, regionQuery, anchorRef, onSelect, onClose }: Props) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const [pendingTest, setPendingTest] = useState<OrthoTest | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = normalize(regionQuery)
    if (!q) return []
    return tests
      .filter(t => t.region && normalize(t.region).includes(q))
      .slice(0, 12)
  }, [tests, regionQuery])

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
      if (pendingTest) {
        if (e.key === 'Escape') { setPendingTest(null); e.preventDefault() }
        return
      }
      if (e.key === 'Escape') { onClose(); e.preventDefault() }
      if (e.key === 'ArrowDown') { setActiveIndex(i => Math.min(i + 1, filtered.length - 1)); e.preventDefault() }
      if (e.key === 'ArrowUp') { setActiveIndex(i => Math.max(i - 1, 0)); e.preventDefault() }
      if (e.key === 'Enter' && filtered[activeIndex]) { setPendingTest(filtered[activeIndex]); e.preventDefault() }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [filtered, activeIndex, onClose, pendingTest])

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

  const handleResult = (test: OrthoTest, result: TestResult) => {
    onSelect(`${test.name} : ${RESULT_LABELS[result]}`)
    setPendingTest(null)
  }

  return createPortal(
    <div
      ref={dropdownRef}
      style={{ position: 'absolute', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
      className="bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
    >
      {filtered.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">Aucun test trouvé pour « {regionQuery} »</p>
      ) : pendingTest ? (
        /* Result picker for selected test */
        <div className="p-2">
          <p className="text-xs font-medium text-muted-foreground px-1 mb-2 truncate">{pendingTest.name}</p>
          <div className="flex gap-1">
            {RESULT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleResult(pendingTest, opt.value)}
                className={`flex-1 flex flex-col items-center gap-0.5 rounded-md py-2 text-xs border border-border transition-colors ${opt.cls}`}
              >
                <span className="text-base">{opt.symbol}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPendingTest(null)}
            className="mt-1 w-full text-xs text-center text-muted-foreground hover:text-foreground py-1"
          >
            ← Retour
          </button>
        </div>
      ) : (
        /* Tests list */
        <ul className="max-h-56 overflow-y-auto py-1">
          {filtered.map((t, i) => (
            <li key={t.id}>
              <button
                type="button"
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => setPendingTest(t)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  i === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'
                }`}
              >
                <span className="font-medium">{t.name}</span>
                {t.region && (
                  <span className="ml-2 text-xs text-muted-foreground">{t.region}</span>
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
