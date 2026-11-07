/**
 * Copie un texte dans le presse-papiers.
 *
 * L'API moderne peut échouer sans prévenir dans l'application de bureau
 * (Electron) ou quand la page n'a pas le focus : on se rabat alors sur
 * l'ancienne méthode, qui fonctionne partout. Renvoie false si rien n'a marché.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Méthode de secours ci-dessous
  }
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}
