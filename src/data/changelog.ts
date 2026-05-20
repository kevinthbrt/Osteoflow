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
    version: '1.1.1',
    date: '2026-05-20',
    title: 'Correctifs icône, mise à jour Mac et build',
    changes: [
      { type: 'fix', text: 'Icône de l\'application corrigée sur macOS (logo Osteoflow au lieu de l\'icône Electron par défaut).' },
      { type: 'improvement', text: 'Sur macOS, la notification de mise à jour propose désormais un lien de téléchargement direct du DMG au lieu d\'un bouton de redémarrage non fonctionnel.' },
      { type: 'fix', text: 'Correction du script d\'installation Gatekeeper (.command) absent du DMG dans la version précédente.' },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-05-20',
    title: 'Dictée IA, arbres décisionnels, pièces jointes et refonte identité',
    changes: [
      // ── Nouvelles fonctionnalités ──
      { type: 'feature', text: 'Dictée intelligente de l\'anamnèse : enregistrez vocalement et laissez Claude structurer le texte automatiquement (motif + anamnèse en Markdown). Reconnexion automatique en cas de coupure réseau.' },
      { type: 'feature', text: 'Pièces jointes dans la messagerie : joignez des fichiers (PDF, images, documents) à vos emails patients ; visualisez et téléchargez les pièces jointes reçues directement dans la conversation.' },
      { type: 'feature', text: 'Arbre décisionnel cervicalgie : algorithme clinique complet (myélopathie, radiculopathie, tension musculaire, spondylarthrite) avec tests interactifs et conseils exportables.' },
      { type: 'feature', text: 'Arbre décisionnel lombalgie v2 : algorithme enrichi avec tests cliniques interactifs, recommandations basées sur les données probantes (AAFP 2025), conseils exportables et insertion directe dans la consultation.' },
      { type: 'feature', text: 'Délai de relance configurable par consultation : choisissez le nombre de jours avant l\'email de suivi J+X directement dans le formulaire (plus seulement le réglage global J+7).' },
      { type: 'feature', text: 'Visite guidée interactive au premier démarrage : 15 étapes couvrant toutes les fonctionnalités, relançable à tout moment via le bouton ? dans l\'en-tête.' },
      { type: 'feature', text: 'Rappel de sauvegarde intelligent : notification automatique si aucune sauvegarde n\'a été effectuée depuis 14 jours, avec téléchargement en un clic.' },
      { type: 'feature', text: 'Flux d\'acceptation des CGU et politique de confidentialité au premier lancement, avec onglet légal dédié dans les paramètres.' },
      // ── Améliorations ──
      { type: 'improvement', text: 'Rendu Markdown dans toutes les vues de consultation : le texte structuré par l\'IA (gras, paragraphes) s\'affiche correctement dans la fiche, le panneau des consultations précédentes et la timeline patient.' },
      { type: 'improvement', text: 'Notes du patient visibles pendant la consultation : les notes personnelles sont affichées dans le panneau latéral lors de la saisie d\'une séance.' },
      { type: 'improvement', text: 'Premiers démarrages : CGU → visite guidée → rappel sauvegarde s\'affichent dans l\'ordre sans se superposer.' },
      { type: 'improvement', text: 'Installation Mac Apple Silicon : le DMG inclut "Ouvrir Osteoflow.command" — double-cliquez pour retirer automatiquement le blocage Gatekeeper.' },
      { type: 'improvement', text: 'Redimensionnement automatique des zones de texte lors de l\'insertion programmatique (arbres décisionnels, dictée IA).' },
      { type: 'improvement', text: 'CGU v1.1 : section ajoutée sur la dictée IA et le traitement des données vocales via le proxy Osteoupgrade / Anthropic.' },
      { type: 'improvement', text: 'Identité visuelle : renommage MyOsteoFlow, police calligraphique dans la sidebar, icône de l\'application sur la page de connexion.' },
      // ── Correctifs ──
      { type: 'fix', text: 'Restauration de sauvegarde : corrige l\'erreur "database disk image is malformed" — la connexion est fermée et les fichiers WAL/SHM supprimés avant d\'écrire le fichier restauré.' },
      { type: 'fix', text: 'Messagerie : les caractères accentués français (é, è, à, ê, ë…) s\'affichent correctement dans les emails reçus en ISO-8859-1 / Windows-1252. Bouton Resync pour corriger les messages déjà importés.' },
      { type: 'fix', text: 'Dictée vocale : le transcript n\'est plus effacé lors d\'une reconnexion automatique après coupure réseau (réécriture avec refs stables).' },
      { type: 'fix', text: 'Arbre lombalgie : la durée aiguë ne remplace plus le diagnostic spécifique déjà établi.' },
      { type: 'fix', text: 'Dropdown "adressé par" : s\'affiche correctement via un portal React (n\'était plus visible dans les formulaires imbriqués).' },
      { type: 'fix', text: 'Proxy d\'authentification Osteoupgrade routé via l\'API Next.js pour éviter les erreurs CORS en développement.' },
    ],
  },
  {
    version: '1.0.53',
    date: '2026-05-04',
    title: 'Correction suppression des types de séance',
    changes: [
      { type: 'fix', text: 'La suppression d\'un type de séance fonctionnait pas à cause d\'une contrainte SQLite (foreign key) — remplacée par une désactivation douce qui préserve l\'historique des consultations existantes' },
    ],
  },
  {
    version: '1.0.52',
    date: '2026-05-04',
    title: 'Gestion des types de séance et facturation améliorée',
    changes: [
      { type: 'improvement', text: 'Paramètres > Facturation : les types de séance peuvent maintenant être modifiés (édition inline) et supprimés' },
      { type: 'improvement', text: 'Formulaire de consultation : le type de séance est désormais sélectionnable directement dans l\'encart Facturation, avec le montant et le mode de paiement' },
    ],
  },
  {
    version: '1.0.51',
    date: '2026-04-23',
    title: 'Correctifs brouillon, import patient et recherche multi-mots',
    changes: [
      { type: 'fix', text: 'Le brouillon de consultation est bien supprimé après enregistrement : plus de bannière "Consultation en cours" proposant de reprendre une séance déjà facturée' },
      { type: 'fix', text: 'Import patient : détection du nom, prénom et genre même quand "Mme" ou "Mr" est absent, en se basant sur le marqueur "F," ou "H," qui précède la date de naissance' },
      { type: 'improvement', text: 'Recherche multi-mots dans les barres de recherche patient (dashboard, liste patients, picker "adressé par", nouvelle conversation) : "Martin Dupont" trouve désormais un patient dont le prénom est Martin et le nom Dupont' },
    ],
  },
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
