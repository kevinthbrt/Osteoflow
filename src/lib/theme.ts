export type ThemeMode = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'myosteoflow-theme'

// Pastille "découverte" affichée sur le bouton de thème jusqu'au premier
// clic — signale la fonctionnalité aux utilisateurs qui mettent à jour
// depuis une version où elle n'existait pas encore.
export const THEME_TOGGLE_HINT_SEEN_KEY = 'myosteoflow-theme-toggle-hint-seen'

export function isThemeToggleHintSeen(): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(THEME_TOGGLE_HINT_SEEN_KEY) === '1'
}

export function markThemeToggleHintSeen() {
  window.localStorage.setItem(THEME_TOGGLE_HINT_SEEN_KEY, '1')
}

export function getStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

export function applyTheme(mode: ThemeMode) {
  document.documentElement.classList.toggle('dark', resolveTheme(mode) === 'dark')
}

// Exécuté en inline script (voir layout.tsx) avant l'hydratation React, pour
// éviter un flash clair→sombre au chargement. Gardé ici en référence — le
// contenu réel est dupliqué en chaîne dans layout.tsx car les scripts inline
// ne peuvent pas importer de module.
export const THEME_INIT_SCRIPT = `(function(){try{var m=localStorage.getItem('${THEME_STORAGE_KEY}')||'system';var d=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`
