'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sun, Moon, Monitor } from 'lucide-react'
import {
  applyTheme,
  getStoredThemeMode,
  isThemeToggleHintSeen,
  markThemeToggleHintSeen,
  THEME_STORAGE_KEY,
  type ThemeMode,
} from '@/lib/theme'
import { cn } from '@/lib/utils'

const MODES: ThemeMode[] = ['light', 'dark', 'system']

const ICONS: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}

const LABELS: Record<ThemeMode, string> = {
  light: 'Thème clair — cliquer pour passer en sombre',
  dark: 'Thème sombre — cliquer pour suivre le système',
  system: 'Thème système — cliquer pour passer en clair',
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>('system')
  const [showHint, setShowHint] = useState(false)

  // Lit la préférence stockée seulement après le montage (évite un
  // mismatch d'hydratation, le rendu serveur ne connaît pas localStorage).
  useEffect(() => {
    setMode(getStoredThemeMode())
    setShowHint(!isThemeToggleHintSeen())
  }, [])

  useEffect(() => {
    applyTheme(mode)
    if (mode !== 'system') return
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => applyTheme('system')
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [mode])

  const cycle = () => {
    const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length]
    setMode(next)
    window.localStorage.setItem(THEME_STORAGE_KEY, next)
    if (showHint) {
      setShowHint(false)
      markThemeToggleHintSeen()
    }
  }

  const Icon = ICONS[mode]

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycle}
      className={cn(
        'hidden sm:flex rounded-full text-muted-foreground hover:text-foreground h-9 w-9',
        showHint && 'pulse-dot'
      )}
      title={showHint ? 'Nouveau : activez le mode sombre ici !' : LABELS[mode]}
    >
      <Icon className="h-4 w-4" />
    </Button>
  )
}
