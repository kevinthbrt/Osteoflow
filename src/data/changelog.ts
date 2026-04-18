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
    version: '1.0.50',
    date: '2026-04-18',
    title: 'Topographie Osteoupgrade, saisie PIN clavier et reprise de consultation',
    changes: [
      { type: 'feature', text: 'Panneau Topographie dans les consultations : affiche les vraies données Osteoupgrade (22 vues, 10 régions, images et descriptions cliniques complètes)' },
      { type: 'feature', text: 'Bannière "Consultation en cours" sur le dossier patient : reprend automatiquement un brouillon non terminé' },
      { type: 'improvement', text: 'Saisie du code PIN possible au clavier physique (chiffres 0–9 et Backspace)' },
      { type: 'fix', text: 'Correction des caractères accentués affichés en unicode brut dans la sidebar et l\'écran PIN (Déconnexion, verrouillée, etc.)' },
    ],
  },
  {
    version: '1.0.49',
    date: '2026-04-18',
    title: 'Sécurité session et sauvegarde automatique des consultations',
    changes: [
      { type: 'feature', text: 'Bouton "Verrouiller" dans la sidebar : verrouille la session sans déconnecter le compte Osteoupgrade' },
      { type: 'feature', text: 'Déverrouillage par code PIN avec retour automatique à la consultation en cours si applicable' },
      { type: 'feature', text: 'Verrouillage automatique après 30 minutes d\'inactivité' },
      { type: 'feature', text: 'Sauvegarde automatique du brouillon de consultation toutes les 30 secondes' },
      { type: 'feature', text: 'Restauration du brouillon après déverrouillage si une consultation était en cours' },
      { type: 'improvement', text: 'La déconnexion affiche un avertissement avant de supprimer le compte Osteoupgrade lié' },
      { type: 'fix', text: 'Correction de l\'enregistrement du code PIN (bug silencieux dans l\'accès base de données)' },
      { type: 'fix', text: 'Correction de la connexion au compte Osteoupgrade (table de sessions manquante côté serveur)' },
    ],
  },
  {
    version: '1.0.48',
    date: '2026-04-13',
    title: 'Frise des objectifs améliorée',
    changes: [
      { type: 'improvement', text: 'Séparateurs de mois sur la frise annuelle en noir pour une meilleure lisibilité' },
      { type: 'feature', text: 'Quand on est en avance sur le prévisionnel, affichage du nombre de jours de congés équivalents à l\'avance' },
    ],
  },
  {
    version: '1.0.47',
    date: '2026-03-13',
    title: 'Statut juridique, améliorations factures et mises à jour',
    changes: [
      { type: 'feature', text: 'Ajout du statut juridique du praticien (ex: EI) dans les paramètres, affiché sur les factures après le nom' },
      { type: 'fix', text: 'Correction du centrage du texte dans le badge du mode de paiement sur les factures PDF' },
      { type: 'improvement', text: 'Le bloc de modification du paiement dans les consultations est maintenant mis en évidence avec une bordure colorée et une icône' },
      { type: 'improvement', text: 'Notification de mise à jour impossible à fermer quand elle est prête, avec instructions étape par étape' },
      { type: 'improvement', text: 'Indicateur vert pulsant dans la sidebar quand une mise à jour est disponible' },
    ],
  },
  {
    version: '1.0.46',
    date: '2026-03-06',
    title: 'Import rapide depuis Doctolib',
    changes: [
      { type: 'feature', text: 'Bouton "Importer depuis Doctolib" sur le formulaire de création de patient' },
      { type: 'feature', text: 'Détection automatique du nom, prénom, date de naissance, téléphone, email et genre depuis un copier-coller Doctolib' },
      { type: 'improvement', text: 'Support du format multi-lignes Doctolib (labels et valeurs sur des lignes séparées)' },
      { type: 'improvement', text: 'Détection intelligente des labels avec parenthèses (ex: "Tél (portable)")' },
    ],
  },
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
