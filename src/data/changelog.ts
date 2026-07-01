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
    version: '1.11.8',
    date: '2026-07-01',
    title: 'Fiche d\'exercices IA simplifiée & correctif injection des antécédents',
    changes: [
      { type: 'improvement', text: 'Fiche d\'exercices générée par IA : les trois boutons de fin (Sauvegarder, Télécharger et sauvegarder, Envoyer par mail) sont remplacés par deux boutons clairs — Imprimer et Envoyer par mail. Dans les deux cas, le programme est automatiquement sauvegardé dans le dossier du patient avant l\'action.' },
      { type: 'fix', text: 'Anamnèse — détection IA des antécédents : cliquer sur "Valider tout" pouvait n\'injecter qu\'une partie des antécédents détectés (chirurgical, traumatique, médical, familial) avec un message d\'erreur générique, sans possibilité de réessayer les éléments manquants. Chaque antécédent est désormais traité indépendamment et les éléments en échec restent affichés pour être revalidés.' },
    ],
  },
  {
    version: '1.11.7',
    date: '2026-06-29',
    title: 'Import de patients conforme RGPD',
    changes: [
      { type: 'improvement', text: 'Import de données : l\'import de vos patients depuis un ancien logiciel se fait désormais entièrement sur votre poste. Votre fichier est lu et analysé dans votre navigateur, puis les patients et consultations sont enregistrés directement dans votre base — plus aucune donnée de santé n\'est envoyée par email à notre équipe. Vous restez seul responsable de traitement, conformément au RGPD.' },
      { type: 'improvement', text: 'Import de données : nouvelle correspondance automatique des colonnes (nom, prénom, date de naissance, antécédents, consultations…) avec ajustement manuel et aperçu avant import.' },
    ],
  },
  {
    version: '1.11.6',
    date: '2026-06-24',
    title: 'Suivi en édition de consultation et mises à jour Windows plus fluides',
    changes: [
      { type: 'fix', text: 'Suivi automatisé : il est désormais correctement programmé — ou annulé — lorsque vous l\'activez ou le modifiez en éditant une consultation déjà enregistrée. Auparavant, activer le suivi après coup restait sans effet (aucun email programmé). Le délai part de la date de la consultation.' },
      { type: 'improvement', text: 'Windows : les mises à jour s\'installent désormais en silence et l\'application redémarre toute seule, comme sur Mac — fini l\'assistant d\'installation à dérouler à chaque mise à jour.' },
    ],
  },
  {
    version: '1.11.5',
    date: '2026-06-24',
    title: 'Correctif tampon sur les factures et courriers',
    changes: [
      { type: 'fix', text: 'Le tampon (cachet et signature) configuré dans les paramètres réapparaît correctement en bas des factures et des courriers PDF — il avait disparu suite à la mise à jour précédente.' },
    ],
  },
  {
    version: '1.11.4',
    date: '2026-06-24',
    title: 'Sécurité renforcée',
    changes: [
      { type: 'improvement', text: 'Confidentialité renforcée : l\'accès à vos données de cabinet est désormais strictement limité à votre ordinateur et n\'est plus joignable depuis le réseau local.' },
      { type: 'improvement', text: 'Sécurité : durcissement du service interne de l\'application (protection contre les accès non autorisés aux fichiers).' },
      { type: 'improvement', text: 'Sécurité : les échanges avec votre compte OsteoUpgrade (e-learning, flashcards, support…) utilisent désormais une authentification par session personnelle.' },
    ],
  },
  {
    version: '1.11.1',
    date: '2026-06-23',
    title: 'Correctif dictée vocale sur Mac',
    changes: [
      { type: 'fix', text: 'Dictée vocale : correction d\'un entitlement macOS incorrect qui rendait le microphone silencieux après la mise à jour v1.11.0 sur Mac (l\'application recevait un flux audio vide au lieu d\'une erreur explicite).' },
    ],
  },
  {
    version: '1.11.0',
    date: '2026-06-23',
    title: 'Aide au diagnostic, amélioration interface consultation et mises à jour macOS',
    changes: [
      { type: 'feature', text: 'Aide au diagnostic : après la transcription de l\'anamnèse, l\'application propose de générer des hypothèses de diagnostic, des questions complémentaires et des tests cliniques suggérés. La génération se lance en parallèle de la structuration pour minimiser l\'attente.' },
      { type: 'improvement', text: 'Interface consultation : refonte visuelle complète — mise en page fluide, encarts thématiques, en-tête allégé, fiche patient enrichie, pièces jointes en colonne latérale et suivi/facturation regroupés dans une modale de fin de séance.' },
      { type: 'improvement', text: 'Brouillon enrichi : les cartes d\'anamnèse structurées et les hypothèses cliniques sont maintenant sauvegardées dans le brouillon — plus de perte après mise en veille de l\'ordinateur.' },
      { type: 'fix', text: 'Le loader « Génération des hypothèses en cours… » ne restait plus bloqué à l\'écran après réception des résultats.' },
      { type: 'improvement', text: 'Mises à jour macOS : signature du code et notarisation Apple activées — les mises à jour automatiques fonctionnent désormais sur Mac Apple Silicon (ARM64) et Intel, au même titre que Windows.' },
    ],
  },
  {
    version: '1.10.0',
    date: '2026-06-19',
    title: 'Comptabilité repensée, objectifs en couleurs et tampon sur les courriers',
    changes: [
      // Comptabilité
      { type: 'feature', text: 'Comptabilité : la page adopte le même style moderne que les objectifs — une grande carte dégradée met en avant le chiffre d\'affaires, les consultations et le panier moyen, avec une ventilation par mode de paiement illustrée par des barres proportionnelles.' },
      { type: 'improvement', text: 'Comptabilité : la barre de filtres (Période, Date début, Date fin, Mode de paiement) est compacte et regroupée. Le bouton « Corrections » y est intégré et ouvre l\'éditeur des corrections manuelles juste en dessous.' },
      { type: 'improvement', text: 'Comptabilité — corrections manuelles : l\'ancien grand bloc est remplacé par un éditeur compact. Chaque mois de la période s\'affiche en petite tuile cliquable que l\'on édite sur place, sans encombrer la page.' },
      { type: 'fix', text: 'Comptabilité : sélectionner « Cette année » démarrait par erreur au 31 décembre de l\'année précédente sur certains fuseaux horaires. La période commence désormais correctement au 1er janvier.' },
      // Objectifs
      { type: 'improvement', text: 'Objectifs : les badges de pourcentage et les barres de progression suivent un code couleur clair — vert dès 100 % atteint, ambre à partir de 75 %, neutre en dessous — pour repérer d\'un coup d\'œil les objectifs en avance ou en retard.' },
      // Courriers
      { type: 'improvement', text: 'Courriers générés : votre tampon (configuré dans les paramètres, comme sur les factures) est désormais apposé en bas à droite du PDF. Le pied de page texte qui faisait doublon a été retiré.' },
      { type: 'fix', text: 'Courriers générés : le corps justifié ne déborde plus de la page sur la droite et l\'alignement du bloc destinataire à droite est fiabilisé.' },
      // Anamnèse
      { type: 'improvement', text: 'Anamnèse structurée : une fois la dictée injectée, le contenu s\'affiche directement dans le champ Anamnèse sous forme de cartes thématiques claires (motif, antécédents, histoire de la plainte…) au lieu d\'un bloc de texte brut. Les sections sont conservées et réapparaissent sur les consultations enregistrées et passées.' },
      { type: 'improvement', text: 'Anamnèse structurée : nouveau code couleur sémantique — le rouge et le vert sont désormais réservés aux drapeaux (red flags), le reste des sections adopte des teintes neutres pour ne pas noyer l\'information importante.' },
    ],
  },
  {
    version: '1.9.0',
    date: '2026-06-19',
    title: 'Multi-cabinet, navigation repensée et consultation sans quitter la fiche patient',
    changes: [
      // Multi-cabinet
      { type: 'feature', text: 'Multi-cabinet : créez autant de cabinets que vous souhaitez depuis le menu « Changer de cabinet » (en-tête). Chaque cabinet dispose de ses propres coordonnées, données patients, consultations et comptabilité. Basculez d\'un cabinet à l\'autre en un clic ; vos données sont strictement cloisonnées par défaut.' },
      { type: 'feature', text: 'Multi-cabinet — partage sélectif : activez la mise en commun des données par catégorie (Patients → Consultations → Comptabilité). Un partage partiel est possible : par exemple partager le carnet de patients tout en gardant les consultations et la comptabilité séparées.' },
      { type: 'feature', text: 'Multi-cabinet — suppression : supprimez un cabinet secondaire vide depuis le même dialog. Par sécurité, la suppression est refusée si le cabinet contient des dossiers patients ou s\'il s\'agit du dernier cabinet ou du cabinet actif.' },
      // Navigation patient
      { type: 'feature', text: 'Fiche patient : la page est restructurée en trois onglets — Dossier (coordonnées, antécédents, exercices, statistiques), Consultations (historique complet) et Factures (toutes les factures du patient avec téléchargement PDF). Plus besoin de faire défiler un écran surchargé.' },
      { type: 'feature', text: 'Consultation sans navigation : cliquer sur « Voir » dans la timeline d\'un patient ouvre désormais un modal complet — contenu clinique (anamnèse, examen, conseils), exercices prescrits, résultat du questionnaire J+7 et éditeur de paiement. Vous ne quittez plus la fiche patient.' },
      { type: 'feature', text: 'Facture sans navigation : cliquer sur une facture (depuis la fiche patient ou depuis l\'onglet global Consultations) ouvre un modal complet — détails, statut modifiable en place, paiements modifiables, impression, téléchargement PDF et envoi par email.' },
      // UX improvements
      { type: 'improvement', text: 'Patientes : le badge de genre « Femme » passe en violet pour le distinguer du bleu « Homme » au premier coup d\'œil (fiche patient, tableau des patients, consultations, factures).' },
      { type: 'improvement', text: 'Anamnèse dictée : un bouton « Effacer » permet de repartir de zéro sans rechargement. Le brouillon est maintenant rattaché à chaque patient séparément — changer de patient efface le brouillon du patient précédent plutôt que de le contaminer.' },
      { type: 'improvement', text: 'Rappels de sauvegarde : un bouton dédié apparaît à côté de la cloche dans l\'en-tête pour ouvrir la fenêtre de sauvegarde à tout moment. Une notification desktop peut être envoyée chaque jour à l\'heure de votre choix (configurable dans Paramètres → Données & sécurité).' },
      { type: 'improvement', text: 'Paramètres : la navigation passe à deux niveaux dans un panneau latéral inspiré de macOS — Compte, Cabinet, Pratique, Données & sécurité. Plus de sous-onglets empilés : chaque section est clairement identifiée et accessible en un clic.' },
      { type: 'improvement', text: 'Paramètres : « Import de données » est déplacé dans la section « Données & sécurité », aux côtés de la sauvegarde et de la restauration.' },
      { type: 'improvement', text: 'Interface : le bouton « Déconnexion » quitte la barre latérale et rejoint le menu déroulant du cabinet dans l\'en-tête. La barre reste ainsi centrée sur la navigation clinique.' },
      { type: 'improvement', text: 'Courriers générés : le corps de la lettre est maintenant justifié et le bloc destinataire est aligné à droite, conformément aux standards du courrier médical.' },
      // Fixes
      { type: 'fix', text: 'Consultation : le brouillon ne ressurgissait plus après validation — une sauvegarde automatique différée pouvait écraser la suppression du brouillon si elle s\'exécutait après l\'enregistrement final.' },
      { type: 'fix', text: 'Widget support : la pastille rouge de notification ne disparaissait pas quand l\'admin marquait un ticket comme résolu. Elle s\'efface maintenant correctement dès la prochaine synchronisation.' },
      { type: 'fix', text: 'Tour d\'accueil : les zones mises en évidence apparaissaient en noir au lieu de laisser passer le contenu en dessous. Problème de z-index entre Driver.js et les composants de l\'interface, corrigé.' },
    ],
  },
  {
    version: '1.8.0',
    date: '2026-06-12',
    title: 'Mentions @ec / @tech, antécédents assouplis, démarrage fiabilisé — merci les bêta-testeurs !',
    changes: [
      { type: 'feature', text: 'Mentions intelligentes dans l\'examen clinique : tapez @ec suivi d\'une région (ex: @ecgenou, @ecepaule) pour faire apparaître une liste déroulante des tests orthopédiques de cette zone. Cliquez un test, indiquez Positif / Négatif / Incertain, et le résultat s\'insère automatiquement dans le champ. Navigation au clavier (flèches, Entrée, Échap).' },
      { type: 'feature', text: 'Mes techniques : tapez @tech suivi d\'une région pour insérer vos techniques personnelles en un clic. Créez et gérez votre bibliothèque de techniques (et de tests personnalisés) dans Paramètres → Contenu clinique. Les listes sont triées par fréquence d\'utilisation : vos techniques favorites remontent en premier.' },
      { type: 'feature', text: 'Recommandé par : en plus de la recherche d\'un patient référent, vous pouvez maintenant indiquer une source — Médecin, Internet, Réseaux sociaux, Bouche à oreille, ou Autre avec un champ libre pour préciser.' },
      { type: 'improvement', text: 'Antécédents — âge de début : l\'âge peut désormais être saisi en années, en mois ou en jours, indispensable pour les nourrissons (ex: « depuis l\'âge de 3 mois »).' },
      { type: 'improvement', text: 'Antécédents — date de début : plus besoin de saisir une date complète. Une année seule (2019), un mois et une année (05/2019) ou une date complète (12/05/2019) sont acceptés.' },
      { type: 'improvement', text: 'Antécédents : les boutons de catégorie (Médicaux, Traumatiques, Chirurgicaux, Familiaux) sont visibles dès l\'ouverture de la fiche patient, même sans antécédent existant.' },
      { type: 'improvement', text: 'Le champ « Examen clinique et manipulations » est renommé « Examen clinique et traitement ».' },
      { type: 'improvement', text: 'Tableau de bord : le widget de progression des objectifs remonte juste sous la bannière d\'accueil pour une visibilité immédiate.' },
      { type: 'improvement', text: 'OsteoFlash : la question reste affichée quand vous révélez la réponse — fini la gymnastique mentale pour se souvenir de ce qui était demandé.' },
      { type: 'fix', text: 'Messagerie : suppression du « Bonjour prénom nom » ajouté automatiquement au début des emails — votre message part désormais exactement tel que vous l\'avez écrit (envoi individuel et diffusion).' },
      { type: 'fix', text: 'E-learning : la progression des cours suivis dans MyOsteoFlow est désormais correctement synchronisée avec OsteoUpgrade quand vous marquez une sous-partie comme terminée.' },
      { type: 'fix', text: 'Paramètres cabinet : le champ SIRET accepte maintenant les numéros SIREN (9 chiffres) et SIRET (14 chiffres) avec un contrôle de format clair.' },
      { type: 'fix', text: 'Téléphone patient : validation stricte du format français — 10 chiffres (06 12 34 56 78) ou format international (+33 6 12 34 56 78).' },
      { type: 'improvement', text: 'Messagerie : les libellés « adresse email personnelle » deviennent « adresse email dédiée » pour mieux refléter l\'usage professionnel recommandé.' },
      { type: 'fix', text: 'Mises à jour Windows : le raccourci bureau est recréé à chaque mise à jour — fini l\'erreur « l\'élément auquel ce raccourci renvoie a été modifié ou déplacé ».' },
      { type: 'improvement', text: 'Mises à jour : après avoir cliqué « Redémarrer et mettre à jour », l\'application se relance automatiquement une fois l\'installation terminée.' },
      { type: 'fix', text: 'Démarrage : si le port de l\'application est occupé (processus précédent mal fermé, autre logiciel), MyOsteoFlow bascule automatiquement sur un port libre au lieu de ne pas démarrer.' },
      { type: 'improvement', text: 'Démarrage : en cas de problème, un message d\'erreur clair s\'affiche avec des suggestions (redémarrer, vérifier l\'antivirus) au lieu d\'une fermeture silencieuse. L\'écran de chargement affiche aussi des messages de patience lors des démarrages longs (migration de données, analyse antivirus après mise à jour).' },
    ],
  },
  {
    version: '1.7.0',
    date: '2026-06-07',
    title: 'OsteoFlash — Flashcards spaced repetition & justification EBP des fiches',
    changes: [
      { type: 'feature', text: 'OsteoFlash : nouveau widget de révision par flashcards sur le tableau de bord. Révisez les thèmes cliniques (Lombalgie, Épaule…) avec un système de répétition espacée (algorithme SM-2) — 4 niveaux de difficulté (Oublié, Difficile, Bien, Facile), barre de progression, et re-queue automatique des cartes oubliées en session. Réservé aux abonnés Premium.' },
      { type: 'feature', text: 'OsteoFlash — Deck Épaule : 121 questions-réponses réparties en 21 modules (épidémiologie, anatomie, diagnostic différentiel, tests cliniques EBP, imagerie, tendinopathie de la coiffe, capsulite rétractile, instabilité, SLAP, arthrose GH, syndrome myofascial, thérapie manuelle, pharmacologie, cas cliniques intégratifs…).' },
      { type: 'feature', text: 'Justification EBP des fiches d\'exercices : un bouton (icône flacon) apparaît désormais sur chaque fiche générée par IA. Il affiche la justification clinique complète rédigée par l\'IA à l\'attention du praticien (protocole choisi, bases scientifiques, niveau de preuve).' },
      { type: 'fix', text: 'Fiches d\'exercices IA : correction du champ de sauvegarde de la justification EBP — les fiches créées avant cette version n\'affichaient pas le bouton de justification, ce qui est désormais corrigé.' },
      { type: 'improvement', text: 'OsteoFlash : redesign visuel complet du widget — thème violet, boutons d\'évaluation avec emojis, barre de progression, écran de fin de session, et skeleton de chargement.' },
    ],
  },
  {
    version: '1.6.2',
    date: '2026-06-04',
    title: 'Ressources PDF dans les cours, noms en majuscules & mise à jour macOS',
    changes: [
      { type: 'fix', text: 'E-learning : les ressources PDF attachées aux sous-parties des cours s\'affichent désormais correctement et sont téléchargeables depuis le lecteur de cours.' },
      { type: 'improvement', text: 'Patients : les noms de famille sont automatiquement mis en majuscules lors de la saisie (création et modification). Les patients déjà enregistrés sont mis à jour rétroactivement.' },
      { type: 'improvement', text: 'Structuration de l\'anamnèse : libellé d\'attente neutralisé en « Structuration de l\'anamnèse en cours… ».' },
      { type: 'fix', text: 'Mise à jour macOS (Apple Silicon) : le flux d\'installation ferme désormais l\'application avant que vous ne remplaciez la nouvelle version dans Applications, ce qui évite le blocage du remplacement quand l\'ancienne version est encore ouverte.' },
    ],
  },
  {
    version: '1.6.1',
    date: '2026-06-03',
    title: 'Correctif : génération de fiches d\'exercices par IA (erreur 502)',
    changes: [
      { type: 'fix', text: 'Génération de fiches d\'exercices par IA : correction d\'une erreur 502 qui pouvait survenir sur les prescriptions les plus complètes. Le délai d\'attente du service était trop court pour les générations longues ; il a été allongé pour laisser le temps à l\'IA de répondre.' },
    ],
  },
  {
    version: '1.6.0',
    date: '2026-06-03',
    title: 'Génération de fiches d\'exercices par IA & bibliothèque de tests orthopédiques',
    changes: [
      { type: 'feature', text: 'Génération de fiches d\'exercices par IA : nouveau bouton "Exercices par IA" dans le formulaire de consultation. L\'IA sélectionne et justifie des exercices de rééducation adaptés au profil du patient (âge, genre, activité sportive, antécédents, diagnostic, niveau) à partir de la base OsteoUpgrade. Export PDF et envoi par email directement depuis la fenêtre de prévisualisation.' },
      { type: 'feature', text: 'PDF d\'exercices : photos agrandies, retour à la ligne automatique sur toutes les zones de texte (description, justification IA, notes), signature "MyOsteoFlow".' },
      { type: 'feature', text: 'Bibliothèque de tests orthopédiques : nouveau bouton "Tests orthos" à côté du champ Examen clinique. Parcourez les 116 tests de la base OsteoUpgrade par région (Épaule, Genou, Lombaire…) ou par cluster EBP validé (Laslett, Wainner, Cook, Sutlive…). Sélectionnez les tests effectués, indiquez Positif / Négatif / Incertain, puis injectez automatiquement les résultats dans le champ Examen.' },
      { type: 'feature', text: 'Clusters de tests : mode "Clusters" dans le picker — sélectionnez tous les tests d\'un cluster en un clic. À l\'injection, les tests sont regroupés sous leur cluster ("Cluster réalisé : Cluster de Laslett") pour une traçabilité EBP claire.' },
      { type: 'improvement', text: 'Recherche de tests insensible aux accents et à la casse : "epaule" trouve "Épaule", "cephalee" trouve "Céphalées".' },
      { type: 'improvement', text: 'Boutons d\'action clinique mis en valeur avec des couleurs distinctives : Topographie (bleu), Tests orthos (vert), Exercices (violet), Exercices par IA (fuchsia).' },
    ],
  },
  {
    version: '1.5.3',
    date: '2026-06-01',
    title: 'Correctif : diffusions bloquantes au premier login',
    changes: [
      { type: 'fix', text: 'Premier login : les diffusions n\'apparaissent plus par-dessus les CGU et la visite guidée. Elles s\'affichent désormais uniquement une fois l\'onboarding terminé.' },
    ],
  },
  {
    version: '1.5.2',
    date: '2026-05-31',
    title: 'Correctif : envoi du récapitulatif comptable',
    changes: [
      { type: 'fix', text: 'Envoi du récapitulatif comptable : correction d\'une erreur d\'authentification SMTP qui empêchait l\'envoi du PDF comptable pour les utilisateurs ayant configuré un mot de passe d\'application Gmail.' },
    ],
  },
  {
    version: '1.5.1',
    date: '2026-05-30',
    title: 'Correctifs : page d\'accueil, diffusions & affichage des annonces',
    changes: [
      { type: 'fix', text: 'Page d\'accueil au lancement : l\'application ouvre désormais le Dashboard au lieu de la liste des patients.' },
      { type: 'fix', text: 'Synchronisation des diffusions : les annonces supprimées disparaissent correctement et les nouvelles apparaissent immédiatement (correction d\'un cache qui figeait la liste).' },
      { type: 'fix', text: 'Affichage des annonces : la fenêtre d\'une diffusion ouverte depuis la cloche de notifications ne dépasse plus de l\'écran.' },
    ],
  },
  {
    version: '1.5.0',
    date: '2026-05-30',
    title: 'E-Learning intégré, Communication IA, Tests orthos, Étiopathes & refonte interface',
    changes: [
      { type: 'feature', text: 'Module E-Learning : retrouvez toutes vos formations OsteoUpgrade directement dans MyOsteoFlow — liste complète des cours avec votre progression, lecteur intégré chapitre par chapitre et barre de progression synchronisée dans le widget du tableau de bord.' },
      { type: 'feature', text: 'Module Communication — Génération de courriers par IA : rédigez des courriers patients en quelques secondes (compte-rendu, courrier médecin traitant…) grâce à un panel dédié. Sélecteur de patient et de consultation, templates prédéfinis, IA génère le contenu, mise en page structurée (expéditeur/destinataire/objet/formule de clôture) et export PDF.' },
      { type: 'feature', text: 'Suggestions de tests orthopédiques par IA : nouveau bouton "Tests orthos" dans le formulaire de consultation — entrez le motif et l\'IA propose les tests cliniques les plus adaptés, avec leur interprétation et leur pertinence, directement insérables dans la consultation.' },
      { type: 'feature', text: 'Support complet des Étiopathes : nouveaux champs RPE et RNE dans les paramètres (remplacent le numéro RPPS) ; le titre professionnel s\'adapte automatiquement à la profession sélectionnée ; les numéros RPE et RNE apparaissent sur toutes les factures, ordonnances d\'exercices, emails de suivi et courriers générés.' },
      { type: 'feature', text: 'Tableau de bord OsteoUpgrade : widget "Revue de littérature" (dernier article) + widget "Nouveauté" (formation mise en avant avec progression) encadrent la vidéo de pratique du jour.' },
      { type: 'feature', text: 'Alerte anniversaire : une bannière apparaît automatiquement sur la fiche patient et lors de la création d\'une consultation le jour de l\'anniversaire du patient.' },
      { type: 'feature', text: 'Broadcasts en temps réel : les annonces publiées par l\'équipe OsteoUpgrade s\'affichent dans la cloche de notifications avec mise à jour automatique.' },
      { type: 'feature', text: 'Widget support flottant : bouton d\'aide déplaçable accessible depuis toutes les pages pour envoyer un ticket directement depuis l\'application.' },
      { type: 'feature', text: 'Widget « Complétez votre profil » sur le tableau de bord : barre de progression et liste des informations manquantes (profil, cabinet, facturation, email, objectifs) avec accès direct à chaque section. Disparaît automatiquement une fois le profil complet à 100%.' },
      { type: 'improvement', text: 'Interface unifiée : Patients et Consultations regroupés sur une seule page avec onglets ; Sondages et Messagerie fusionnés en une section Communication.' },
      { type: 'improvement', text: 'Import CSV : nouvelle étape 2 pour envoyer le fichier brut au support pour transformation et réimport propre.' },
      { type: 'improvement', text: 'Montants et modes de paiement éditables inline dans la ligne de consultation (icône crayon + pill cliquable).' },
      { type: 'improvement', text: 'Âge du patient affiché à côté de la date de naissance dans la fiche de consultation (ex : "12 mars 1990 · 35 ans").' },
      { type: 'fix', text: 'Recherche patient insensible aux accents : "epaule" trouve désormais "épaule" et inversement.' },
      { type: 'fix', text: 'Synchronisation de la progression OsteoUpgrade : utilise l\'email de licence en priorité pour un suivi correct même si l\'email praticien diffère.' },
    ],
  },
  {
    version: '1.4.0',
    date: '2026-05-30',
    title: 'Complétude du profil, motifs intelligents & nouveautés',
    changes: [
      { type: 'feature', text: 'Nouveau widget « Complétez votre profil » sur le tableau de bord : barre de progression et liste des informations manquantes (profil, cabinet, facturation, email, objectifs) avec accès direct à chaque section. Il disparaît une fois le profil complet à 100%.' },
      { type: 'feature', text: 'Statistiques : détection des motifs de consultation par mots-clés. Un motif comme « Lombalgie + Cervicalgie » est désormais comptabilisé dans les deux catégories, avec 22 catégories cliniques reconnues automatiquement.' },
      { type: 'feature', text: 'Comptabilité : nouvelle section « Corrections manuelles (CA corrigé) » pour ajouter un chiffre d\'affaires non facturé par mois. Les corrections se propagent au total de la comptabilité, aux objectifs et aux statistiques.' },
      { type: 'feature', text: 'Cloche de notifications : nouvelle rubrique « Nouveautés » qui vous signale les dernières fonctionnalités dès leur sortie.' },
      { type: 'feature', text: 'Patients archivés : possibilité de désarchiver un patient (réactivation) depuis la liste et la fiche patient.' },
      { type: 'improvement', text: 'Visite guidée enrichie et mise à jour avec les nouveaux modules (Communication, E-Learning, widget de complétude, support).' },
      { type: 'fix', text: 'Factures étiopathes : correction de l\'affichage des numéros RPE et RNE qui débordaient sous le bandeau de couleur.' },
      { type: 'fix', text: 'Statistiques : correction de l\'affichage des barres du diagramme de chiffre d\'affaires mensuel.' },
    ],
  },
  {
    version: '1.3.4',
    date: '2026-05-28',
    title: 'Factures multi-professions & corrections',
    changes: [
      { type: 'feature', text: 'Nouveau champ Profession dans les paramètres (Ostéopathe, Chiropracteur, Étiopathe, Autre) avec sélection du régime TVA — la mention légale en pied de facture s\'adapte automatiquement (art. 261-4-1° CGI, art. 293 B CGI ou TVA 20% avec détail HT/TVA/TTC).' },
      { type: 'fix', text: 'Suppression du libellé "Consultation ostéopathique" codé en dur dans les factures PDF et la page détail — le type de séance défini par le praticien s\'affiche à la place.' },
      { type: 'fix', text: 'Correction du débordement du nom de ville dans l\'en-tête du PDF lorsque la ville est longue (ex. Saint-Germain-en-Laye).' },
      { type: 'fix', text: 'Onglet Sondages : le délai affiché (J+7, J+14…) reflète désormais le paramètre configuré par le praticien au lieu d\'être fixé à J+7.' },
    ],
  },
  {
    version: '1.3.3',
    date: '2026-05-27',
    title: 'Import CSV enrichi',
    changes: [
      { type: 'feature', text: 'Import CSV : support des colonnes Notes et Activité sportive lors de l\'import de patients.' },
    ],
  },
  {
    version: '1.3.2',
    date: '2026-05-26',
    title: 'Refonte dashboard & météo',
    changes: [
      { type: 'feature', text: 'Refonte complète du tableau de bord avec widgets personnalisables (chiffre d\'affaires, prochain rendez-vous, statistiques clés).' },
      { type: 'feature', text: 'Météo dans l\'en-tête avec prévisions 6 jours et recherche de ville par code postal.' },
      { type: 'improvement', text: 'Bouton "Nouvelle consultation" repositionné sous le message d\'accueil du dashboard.' },
      { type: 'fix', text: 'Correction de boucles infinies de re-render dans le Header et le module de messagerie.' },
      { type: 'fix', text: 'Correction de l\'affichage des pièces jointes Resend et du clignotement de la liste patients.' },
      { type: 'fix', text: 'Correction du hook useDebounceCallback qui générait une nouvelle référence à chaque render.' },
    ],
  },
  {
    version: '1.3.1',
    date: '2026-05-26',
    title: 'Correctif programme d\'exercices',
    changes: [
      { type: 'fix', text: 'Correction de l\'erreur au clic sur "Nouveau programme d\'exercices" quand des exercices n\'ont pas de région ou de type défini.' },
    ],
  },
  {
    version: '1.3.0',
    date: '2026-05-26',
    title: 'Détection IA des antécédents et module exercices',
    changes: [
      { type: 'feature', text: 'La dictée de l\'anamnèse détecte automatiquement les antécédents chirurgicaux, traumatiques, médicaux (traitements inclus) et familiaux, en plus des champs patient (métier, sport, médecin traitant, grossesse).' },
      { type: 'feature', text: 'Chaque information détectée par l\'IA s\'affiche avec un bouton ✓ (accepter) et ✕ (ignorer) individuel, plus "Valider tout" et "Tout ignorer" quand plusieurs champs sont en attente.' },
      { type: 'feature', text: 'Le bouton d\'injection applique désormais aussi les antécédents et champs patient détectés, pas uniquement l\'anamnèse structurée.' },
      { type: 'feature', text: 'Les antécédents acceptés s\'affichent immédiatement dans la colonne gauche de la consultation, sans recharger la page.' },
      { type: 'feature', text: 'Les cartes d\'antécédents utilisent un code couleur par type (chirurgical, traumatique, médical, familial), identique aux boutons de création.' },
      { type: 'feature', text: 'Module exercices : ajout des champs cible nerveuse et progression/régression dans la prescription ; envoi par email PDF et téléchargement direct.' },
      { type: 'improvement', text: 'Limite d\'enregistrement de la dictée portée à 10 minutes (alerte à 9 min).' },
      { type: 'improvement', text: 'Viewer PDF affiché en ligne dans l\'application (plus de téléchargement forcé).' },
      { type: 'fix', text: 'Correction de l\'erreur dans la prescription d\'exercices lors de l\'ouverture du sélecteur de fréquence.' },
    ],
  },
  {
    version: '1.1.7',
    date: '2026-05-20',
    title: 'Dictée vocale gratuite via Whisper local',
    changes: [
      { type: 'fix', text: 'Dictée dans l\'app bureau : remplacement de webkitSpeechRecognition (incompatible Electron) par Whisper Base via Transformers.js — fonctionne 100 % en local, sans clé API ni abonnement.' },
      { type: 'improvement', text: 'Premier lancement : téléchargement automatique du modèle Whisper (~77 Mo). Ensuite tout reste en cache local, pas de connexion requise.' },
    ],
  },
  {
    version: '1.1.6',
    date: '2026-05-20',
    title: 'Correctifs images et dictée vocale',
    changes: [
      { type: 'fix', text: 'Images (logos) : désactivation de l\'optimisation Next.js pour les servir directement depuis les fichiers statiques — résout les images cassées dans l\'app packagée.' },
      { type: 'fix', text: 'Dictée vocale : ajout du gestionnaire de vérification de permission (setPermissionCheckHandler) en plus de la demande, et déclaration NSSpeechRecognitionUsageDescription sur macOS.' },
    ],
  },
  {
    version: '1.1.5',
    date: '2026-05-20',
    title: 'Correctif dictée vocale et logo',
    changes: [
      { type: 'fix', text: 'Dictée vocale : correction de la boucle infinie "reconnexion en cours" dans l\'app packagée — Electron n\'accordait pas l\'accès au microphone silencieusement.' },
      { type: 'fix', text: 'Logo bundlé directement dans le build Next.js — résout définitivement l\'image cassée sur macOS ARM64.' },
    ],
  },
  {
    version: '1.1.4',
    date: '2026-05-20',
    title: 'Correctif définitif du logo sur macOS',
    changes: [
      { type: 'fix', text: 'Logo bundlé directement dans le build Next.js (import statique) — résout définitivement l\'image cassée dans la sidebar, l\'écran de connexion et l\'écran PIN sur macOS ARM64.' },
    ],
  },
  {
    version: '1.1.3',
    date: '2026-05-20',
    title: 'Correctif logo dans la sidebar et écrans de connexion',
    changes: [
      { type: 'fix', text: 'Le logo s\'affiche correctement dans la sidebar, l\'écran de connexion et l\'écran PIN sur macOS (le serveur Electron sert maintenant les fichiers statiques directement).' },
    ],
  },
  {
    version: '1.1.2',
    date: '2026-05-20',
    title: 'Correctifs logo, fenêtre et icône Mac',
    changes: [
      { type: 'fix', text: 'Logo de l\'application affiché correctement sur l\'écran de connexion et l\'écran PIN (remplace l\'icône cœur générique).' },
      { type: 'fix', text: 'Image du logo visible dans la sidebar (le dossier public/ est maintenant inclus dans le build Electron).' },
      { type: 'improvement', text: 'La fenêtre peut être déplacée en cliquant-glissant depuis la zone du logo dans la sidebar sur macOS.' },
    ],
  },
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
