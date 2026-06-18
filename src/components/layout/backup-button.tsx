'use client'

import { Button } from '@/components/ui/button'
import { HardDriveDownload } from 'lucide-react'

/**
 * Bouton de sauvegarde placé à côté de la cloche de notifications.
 * Ouvre la boîte de dialogue de sauvegarde (rappel + téléchargement du fichier),
 * qui rappelle qu'il est interdit de déposer la sauvegarde sur un cloud.
 */
export function BackupButton() {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => window.dispatchEvent(new Event('open-backup-dialog'))}
      className="rounded-full text-muted-foreground hover:text-foreground h-9 w-9"
      title="Sauvegarder mes données"
      aria-label="Sauvegarder mes données"
    >
      <HardDriveDownload className="h-4 w-4" />
    </Button>
  )
}
