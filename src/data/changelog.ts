export interface ChangelogEntry {
  version: string
  date: string
  title: string
  changes: {
    type: 'feature' | 'fix' | 'improvement'
    text: string
  }[]
}

/**
 * Application changelog.
 *
 * Add new entries at the TOP of the array when releasing a new version.
 * This data is used by:
 * - The "What's New" dialog shown after an update
 * - The /changelog page
 * - The update banner (to show what's coming)
 */
export const changelog: ChangelogEntry[] = [
  {
    version: '1.0.41',
    date: '2026-02-23',
    title: 'Notifications de mise à jour et changelog',
    changes: [
      { type: 'feature', text: 'Bannière in-app lors du téléchargement d\'une mise à jour avec bouton "Redémarrer maintenant"' },
      { type: 'feature', text: 'Dialog "Quoi de neuf ?" affichée après chaque mise à jour' },
      { type: 'feature', text: 'Page changelog accessible depuis la sidebar' },
      { type: 'fix', text: 'Correction de l\'envoi en double des emails de suivi J+7' },
      { type: 'fix', text: 'Correction des sondages dupliqués par consultation' },
    ],
  },
  {
    version: '1.0.40',
    date: '2026-02-23',
    title: 'Correctifs emails J+7 et améliorations sondages',
    changes: [
      { type: 'fix', text: 'Correction de l\'envoi en double des emails de suivi J+7' },
      { type: 'fix', text: 'Correction des sondages dupliqués par consultation' },
      { type: 'improvement', text: 'Ajout de l\'identité patient dans les réponses aux sondages' },
      { type: 'feature', text: 'Nouveau champ "adressé par" et statistiques d\'adressage' },
    ],
  },
  {
    version: '1.0.39',
    date: '2026-02-20',
    title: 'Sondages de satisfaction J+7',
    changes: [
      { type: 'feature', text: 'Envoi automatique de sondages de satisfaction à J+7' },
      { type: 'feature', text: 'Tableau de bord des réponses aux sondages' },
      { type: 'feature', text: 'Synchronisation des réponses depuis le formulaire en ligne' },
      { type: 'improvement', text: 'Amélioration du template HTML des emails de suivi' },
    ],
  },
  {
    version: '1.0.38',
    date: '2026-02-15',
    title: 'Emails programmés et messagerie',
    changes: [
      { type: 'feature', text: 'Système d\'emails programmés avec suivi du statut' },
      { type: 'feature', text: 'Synchronisation de la boîte de réception (IMAP)' },
      { type: 'improvement', text: 'Amélioration de la configuration SMTP dans les paramètres' },
    ],
  },
  {
    version: '1.0.37',
    date: '2026-02-10',
    title: 'Pièces jointes et améliorations facturation',
    changes: [
      { type: 'feature', text: 'Pièces jointes aux consultations (PDF, images, documents)' },
      { type: 'feature', text: 'Glisser-déposer de fichiers' },
      { type: 'improvement', text: 'Amélioration du formulaire de facturation' },
      { type: 'fix', text: 'Corrections mineures d\'affichage' },
    ],
  },
]
