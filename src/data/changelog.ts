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
    version: '1.0.44',
    date: '2026-03-02',
    title: 'Page consultations unifiée et améliorations sondages',
    changes: [
      { type: 'feature', text: 'Fusion des pages Consultations et Factures en une seule page avec filtre par période' },
      { type: 'feature', text: 'Modification du mode de paiement directement depuis la ligne de consultation' },
      { type: 'feature', text: 'Marquer les réponses aux sondages comme traitées pour les archiver' },
      { type: 'fix', text: 'Correction des notifications de sondages qui ne s\'affichaient pas' },
      { type: 'improvement', text: 'Affichage compact des sondages traités et en attente de réponse' },
      { type: 'fix', text: 'Correction du timeout au démarrage en mode développement' },
    ],
  },
  {
    version: '1.0.43',
    date: '2025-02-25',
    title: 'Cloche de notifications et envoi d\'email depuis les sondages',
    changes: [
      { type: 'feature', text: 'Cloche de notifications avec menu déroulant regroupant sondages, messages et mises à jour' },
      { type: 'feature', text: 'Popup éphémère sous la cloche lors de la réception d\'une nouvelle notification' },
      { type: 'feature', text: 'Bouton "Envoyer un mail" sur chaque réponse de sondage pour contacter directement le patient' },
      { type: 'feature', text: 'Les mises à jour apparaissent dans la cloche avec barre de progression et bouton de redémarrage' },
      { type: 'improvement', text: 'Rafraîchissement en temps réel des notifications lors de la synchronisation des sondages et emails' },
    ],
  },
  {
    version: '1.0.42',
    date: '2026-02-25',
    title: 'Correction du blocage au démarrage',
    changes: [
      { type: 'fix', text: 'Correction de l\'application bloquée sur "Chargement en cours…" au démarrage' },
      { type: 'fix', text: 'Correction du démarrage si le port 3456 est déjà occupé (ex: instance précédente mal fermée)' },
      { type: 'improvement', text: 'Ajout d\'un mécanisme de reconnexion automatique si le chargement de la page échoue' },
      { type: 'improvement', text: 'En mode développement, attente active du serveur avant d\'afficher l\'application' },
    ],
  },
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
