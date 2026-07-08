export const CGU_VERSION = '2.0'
export const CGU_DATE = '23 juin 2026'

export interface LegalSection {
  type: 'h1' | 'h2' | 'h3' | 'p' | 'ul' | 'table' | 'hr'
  content?: string
  items?: string[]
  headers?: string[]
  rows?: string[][]
}

export const CGU_SECTIONS: LegalSection[] = [
  { type: 'h1', content: "Conditions Générales d'Utilisation — MyOsteoFlow & OsteoUpgrade" },
  { type: 'p', content: `**Version ${CGU_VERSION} — En vigueur depuis le ${CGU_DATE}**` },
  { type: 'hr' },

  { type: 'h2', content: 'Article 1 – Objet' },
  { type: 'p', content: "Les présentes Conditions Générales d'Utilisation (« CGU ») régissent l'accès et l'utilisation des services édités par la société **SAS OsteoUpgrade** (ci-après « l'Éditeur »), à savoir :" },
  { type: 'ul', items: [
    "**MyOsteoFlow** (ci-après « le Logiciel ») : application de bureau destinée aux ostéopathes professionnels pour la gestion de leur cabinet (suivi patients, comptes-rendus, facturation, statistiques, dictée intelligente, aide au raisonnement clinique). **Il n'existe pas de mode navigateur pour MyOsteoFlow** : le Logiciel fonctionne exclusivement en tant qu'application installée sur l'ordinateur de l'Utilisateur.",
    "**OsteoUpgrade** (ci-après « le Site ») : plateforme web accessible sur osteo-upgrade.fr, proposant des formations continues, modules e-learning, OsteoFlash (flashcards pédagogiques) et ressources professionnelles destinées aux ostéopathes.",
  ]},
  { type: 'p', content: "En accédant à l'un ou l'autre de ces services, l'Utilisateur accepte sans réserve les présentes CGU." },

  { type: 'h2', content: "Article 2 – Éditeur" },
  { type: 'p', content: "**SAS OsteoUpgrade** — Société par actions simplifiée au capital de 1 000 €" },
  { type: 'p', content: "57 bis route nationale, résidence coté parc, bât A, 06440 Blausasc" },
  { type: 'p', content: "RCS Nice : 106 919 715" },
  { type: 'p', content: "Téléphone : 06 63 24 42 80" },
  { type: 'p', content: "Contact : contact@osteo-upgrade.fr" },
  { type: 'p', content: "Président : Gerald Stoppini — Directeur général : Kevin Thubert" },

  { type: 'h2', content: 'Article 3 – Définitions' },
  { type: 'ul', items: [
    "**Utilisateur** : tout ostéopathe professionnel ayant créé un compte OsteoUpgrade et, le cas échéant, installé MyOsteoFlow.",
    "**Abonnement Premium** : offre payante donnant accès à l'ensemble des fonctionnalités de MyOsteoFlow (dictée intelligente, aide au raisonnement clinique, rappels automatiques, envoi d'emails patients) ainsi qu'aux contenus premium d'OsteoUpgrade (e-learning complet, OsteoFlash).",
    "**Données Patients** : toute information saisie dans MyOsteoFlow concernant les patients de l'Utilisateur (identité, antécédents médicaux, comptes-rendus). Ces données sont stockées exclusivement en local.",
    "**Données de Licence** : email, identifiant d'appareil et jeton d'authentification utilisés pour vérifier la validité de l'abonnement.",
    "**OsteoFlash** : module de flashcards pédagogiques disponible sur OsteoUpgrade, permettant de réviser et consolider les connaissances cliniques.",
    "**Aide au raisonnement clinique** : fonctionnalité IA disponible dans MyOsteoFlow et sur OsteoUpgrade, proposant des tests orthopédiques pertinents en fonction du tableau clinique présenté. Il s'agit d'une aide indicative, non d'un outil de diagnostic.",
    "**Responsable de traitement** : l'Utilisateur, en qualité de professionnel de santé exploitant le Logiciel pour le compte de son cabinet.",
    "**Sous-traitant** : l'Éditeur, qui fournit le Logiciel en tant qu'outil de traitement.",
  ]},

  { type: 'h2', content: 'Article 4 – Données Personnelles et Accord de Sous-traitance (DPA)' },

  { type: 'h3', content: '4.1 MyOsteoFlow — Données Patients (stockage local)' },
  { type: 'p', content: "Les données relatives aux patients de l'Utilisateur sont stockées **exclusivement en local** sur l'appareil de l'Utilisateur, dans une base de données SQLite. **L'Éditeur n'a accès à aucune donnée patient.**" },
  { type: 'p', content: "En tant que responsable de traitement au sens du RGPD (Règlement UE 2016/679), il appartient à l'Utilisateur de :" },
  { type: 'ul', items: [
    "informer ses patients du traitement de leurs données (Article 13 RGPD) ;",
    "garantir la sécurité physique de l'appareil sur lequel le Logiciel est installé ;",
    "effectuer des sauvegardes régulières (voir Article 5.2) ;",
    "respecter les durées de conservation légales applicables aux dossiers médicaux.",
  ]},

  { type: 'h3', content: '4.2 Données de Licence' },
  { type: 'p', content: "Dans le seul but de valider l'abonnement, le Logiciel transmet à l'Éditeur, via des appels API sécurisés (HTTPS) : l'adresse email du compte OsteoUpgrade, un identifiant unique de l'appareil, et un jeton d'authentification. Ces données sont traitées sur la base de l'exécution du contrat d'abonnement et ne sont pas utilisées à d'autres fins." },

  { type: 'h3', content: '4.3 Sondages de satisfaction patient' },
  { type: 'p', content: "Le Logiciel propose optionnellement l'envoi de sondages de satisfaction aux patients. Les réponses (note globale, score EVA, commentaire) transitent temporairement par un service Cloudflare Workers hébergé en Europe avant d'être synchronisées en local et supprimées du service intermédiaire. L'Utilisateur est responsable d'informer ses patients de cette fonctionnalité avant de l'activer." },

  { type: 'h3', content: '4.4 Contenu e-learning' },
  { type: 'p', content: "Le Logiciel accède à des contenus pédagogiques (topographies anatomiques) hébergés sur Supabase. Aucune donnée patient n'est transmise dans ce cadre." },

  { type: 'h3', content: '4.5 Communications par email (Resend)' },
  { type: 'p', content: "Le Logiciel peut envoyer des emails aux patients de l'Utilisateur dans les cas suivants : rapport comptable à l'expert-comptable, rappels automatiques de rendez-vous, conseils post-consultation et messages directs. Ces envois utilisent en priorité le serveur SMTP de l'Utilisateur (configuré dans les paramètres). En l'absence de configuration SMTP, le service **Resend** (hébergé en UE) est utilisé comme solution de repli. Dans ce cas, l'adresse email et le nom du destinataire transitent par Resend. Aucune donnée médicale identifiable n'est incluse dans ces envois." },

  { type: 'h3', content: '4.6 Dictée intelligente (fonctionnalité IA — MyOsteoFlow uniquement)' },
  { type: 'p', content: "Le Logiciel propose optionnellement une fonctionnalité de dictée vocale assistée par intelligence artificielle permettant de structurer automatiquement l'anamnèse d'une consultation. Lorsque l'Utilisateur active cette fonctionnalité, l'audio enregistré est transmis à Groq (États-Unis) via un proxy sécurisé exploité par l'Éditeur (OsteoUpgrade), aux fins de transcription par le modèle Whisper large-v3-turbo. L'audio n'est pas conservé après traitement." },
  { type: 'ul', items: [
    "Le texte transcrit est transmis à Anthropic (États-Unis) via un proxy sécurisé exploité par l'Éditeur, aux fins de structuration du contenu clinique.",
    "**Aucune donnée identifiant le patient** (nom, prénom, date de naissance, numéro de sécurité sociale) ne doit figurer dans la dictée — l'Utilisateur en est seul responsable.",
    "Groq et Anthropic peuvent conserver les données transmises conformément à leurs politiques de confidentialité respectives.",
    "L'utilisation de cette fonctionnalité est entièrement facultative et n'affecte pas le fonctionnement du reste du Logiciel.",
  ]},
  { type: 'p', content: "La base juridique du traitement est le **consentement implicite** de l'Utilisateur au moment où il active la dictée. L'Utilisateur reste responsable d'informer ses patients si des données les concernant sont susceptibles d'être dictées." },

  { type: 'h3', content: '4.7 Accord de sous-traitance (Article 28 RGPD)' },
  { type: 'p', content: "En acceptant les présentes CGU, l'Utilisateur reconnaît que l'Éditeur agit en qualité de **sous-traitant** et s'engage à :" },
  { type: 'ul', items: [
    "ne traiter les données que sur instruction documentée de l'Utilisateur (usage normal du Logiciel) ;",
    "garantir la confidentialité des personnes autorisées à traiter les données ;",
    "prendre les mesures de sécurité appropriées (Article 32 RGPD) ;",
    "ne pas recourir à un autre sous-traitant sans information préalable de l'Utilisateur ;",
    "assister l'Utilisateur dans le respect de ses obligations RGPD dans la mesure du possible ;",
    "supprimer ou restituer les données en fin de contrat ;",
    "mettre à disposition les informations nécessaires pour démontrer le respect du présent article.",
  ]},

  { type: 'h2', content: 'Article 5 – Responsabilités' },

  { type: 'h3', content: "5.1 Responsabilité de l'Éditeur" },
  { type: 'p', content: "Le Logiciel et le Site sont fournis « en l'état ». L'Éditeur s'engage à maintenir ses services en conditions opérationnelles et à corriger les anomalies signalées dans des délais raisonnables. La responsabilité de l'Éditeur ne peut être engagée en cas de perte de données due à une défaillance matérielle de l'appareil de l'Utilisateur, de dommage indirect, perte d'exploitation ou manque à gagner." },

  { type: 'h3', content: "5.2 Sauvegardes — responsabilité de l'Utilisateur" },
  { type: 'p', content: "Les données patients étant stockées localement dans MyOsteoFlow, **l'Utilisateur est seul responsable de la réalisation de sauvegardes régulières** sur un support externe (clé USB, disque externe, cloud personnel). L'Éditeur recommande une sauvegarde hebdomadaire a minima. Le Logiciel propose un outil de sauvegarde dans les paramètres à cette fin." },

  { type: 'h3', content: '5.3 Contenu médical et aide au raisonnement clinique' },
  { type: 'p', content: "Les fonctionnalités d'aide intégrées au Logiciel et au Site (aide au raisonnement clinique, suggestions de tests orthopédiques, structuration de comptes-rendus par IA, aide à la rédaction de courriers) sont fournies **à titre indicatif uniquement**. Elles ne constituent pas un diagnostic médical, ne remplacent pas l'examen clinique, et ne se substituent en aucun cas au jugement clinique du praticien. **L'Utilisateur demeure seul responsable des décisions thérapeutiques prises pour ses patients.** L'Éditeur décline toute responsabilité quant aux conséquences de l'utilisation de ces fonctionnalités." },

  { type: 'h2', content: "Article 6 – Avertissement relatif à l'intelligence artificielle" },
  { type: 'p', content: "Plusieurs fonctionnalités de MyOsteoFlow et d'OsteoUpgrade font appel à des technologies d'intelligence artificielle (IA). L'Utilisateur est expressément informé de ce qui suit :" },
  { type: 'ul', items: [
    "**Aide au raisonnement clinique** : l'IA propose des tests orthopédiques pertinents en fonction des éléments cliniques saisis. Ces suggestions sont des pistes de réflexion, non des prescriptions. Le praticien reste seul juge de leur pertinence.",
    "**Dictée et structuration de comptes-rendus** : l'IA transcrit et structure le discours du praticien. Elle peut commettre des erreurs de transcription ou d'interprétation. L'Utilisateur doit relire et valider tout contenu généré avant de l'intégrer au dossier patient.",
    "**Aide à la rédaction de courriers** : les courriers générés par IA sont des propositions de rédaction. L'Utilisateur doit les vérifier, les corriger si nécessaire, et en assumer la responsabilité médicale et déontologique avant envoi.",
    "**Aucun arbre décisionnel** : le Logiciel ne propose pas d'arbres décisionnels automatiques. Toute décision clinique repose exclusivement sur le praticien.",
    "**L'IA n'est pas un dispositif médical** : aucune des fonctionnalités IA de MyOsteoFlow ou d'OsteoUpgrade n'est certifiée en tant que dispositif médical au sens du règlement UE 2017/745.",
  ]},
  { type: 'p', content: "En utilisant ces fonctionnalités, l'Utilisateur reconnaît avoir pris connaissance de ces avertissements et accepte que la responsabilité clinique, médicale et déontologique de tous les actes réalisés pour ses patients lui appartient entièrement." },

  { type: 'h2', content: 'Article 7 – Propriété intellectuelle' },
  { type: 'p', content: "Le Logiciel, son code source, son interface, les contenus pédagogiques du Site (e-learning, OsteoFlash, articles) et les logos sont la propriété exclusive de l'Éditeur. La licence accordée est limitée à l'usage professionnel personnel de l'Utilisateur. Toute reproduction, modification ou redistribution est interdite sans autorisation écrite préalable." },

  { type: 'h2', content: 'Article 8 – Modifications des CGU' },
  { type: 'p', content: "L'Éditeur se réserve le droit de modifier les présentes CGU. En cas de modification substantielle, l'Utilisateur en sera informé lors de l'ouverture du Logiciel (MyOsteoFlow) ou lors de sa prochaine connexion au Site (OsteoUpgrade), et devra accepter les nouvelles conditions pour continuer à utiliser les services." },

  { type: 'h2', content: 'Article 9 – Résiliation' },
  { type: 'p', content: "L'accès aux fonctionnalités Premium prend fin automatiquement en cas de résiliation ou d'expiration de l'abonnement OsteoUpgrade. Les données patients stockées localement dans MyOsteoFlow restent accessibles à l'Utilisateur, qui en est propriétaire." },

  { type: 'h2', content: 'Article 10 – Droit applicable et juridiction' },
  { type: 'p', content: "Les présentes CGU sont régies par le droit français. Tout litige relatif à leur interprétation ou à leur exécution sera soumis aux tribunaux compétents du ressort du siège social de l'Éditeur." },

  { type: 'h2', content: 'Article 11 – Contact' },
  { type: 'p', content: "Pour toute question relative aux présentes CGU :" },
  { type: 'p', content: "SAS OsteoUpgrade — 57 bis route nationale, résidence coté parc, bât A, 06440 Blausasc" },
  { type: 'p', content: "Téléphone : 06 63 24 42 80 — Email : contact@osteo-upgrade.fr" },
]

export const PRIVACY_SECTIONS: LegalSection[] = [
  { type: 'h1', content: 'Politique de Confidentialité — MyOsteoFlow & OsteoUpgrade' },
  { type: 'p', content: `**Version ${CGU_VERSION} — En vigueur depuis le ${CGU_DATE}**` },
  { type: 'hr' },

  { type: 'h2', content: '1. Qui sommes-nous ?' },
  { type: 'p', content: "MyOsteoFlow et OsteoUpgrade sont édités par la **SAS OsteoUpgrade**, 57 bis route nationale, résidence coté parc, bât A, 06440 Blausasc. Pour toute question relative à la protection de vos données : **contact@osteo-upgrade.fr** — 06 63 24 42 80" },

  { type: 'h2', content: '2. Quelles données sont traitées et pourquoi ?' },

  { type: 'h3', content: "2.1 Données de l'Utilisateur (l'ostéopathe)" },
  { type: 'table',
    headers: ['Données', 'Finalité', 'Base légale'],
    rows: [
      ['Email + mot de passe OsteoUpgrade', 'Authentification et vérification de la licence', 'Exécution du contrat'],
      ["Identifiant de l'appareil (MyOsteoFlow)", 'Gestion des licences par appareil', 'Exécution du contrat'],
      ["Jeton d'authentification", "Vérification périodique de la validité de l'abonnement", 'Exécution du contrat'],
    ],
  },

  { type: 'h3', content: "2.2 Données des patients de l'Utilisateur (MyOsteoFlow uniquement)" },
  { type: 'p', content: "Les données des patients (identité, coordonnées, antécédents, comptes-rendus) sont stockées **exclusivement en local** sur l'appareil de l'Utilisateur. Elles ne sont **jamais transmises** aux serveurs de l'Éditeur. L'ostéopathe est le responsable de traitement au sens du RGPD pour ces données." },

  { type: 'h3', content: '2.3 Données des sondages de satisfaction' },
  { type: 'p', content: "Si l'Utilisateur active l'envoi de sondages, les réponses des patients transitent temporairement par un service Cloudflare Workers. Ces réponses sont synchronisées en local dès que le Logiciel est ouvert (vérification automatique toutes les 10 minutes), puis **supprimées du service intermédiaire** ; à défaut de synchronisation, elles sont automatiquement purgées du service intermédiaire au bout de **30 jours maximum**." },

  { type: 'h3', content: '2.4 Données de la dictée vocale intelligente (IA — MyOsteoFlow uniquement)' },
  { type: 'p', content: "Lorsque l'Utilisateur utilise la fonctionnalité de dictée intelligente (optionnelle) dans MyOsteoFlow, l'enregistrement audio est transmis à **Groq** (États-Unis) via un proxy sécurisé exploité par l'Éditeur, uniquement pour la durée de la transcription. L'audio n'est pas conservé après traitement. Le texte transcrit est ensuite transmis à **Anthropic** (États-Unis) via un proxy sécurisé exploité par l'Éditeur, pour la structuration clinique. L'Utilisateur s'engage à ne pas inclure d'informations identifiantes dans la dictée." },

  { type: 'h2', content: '3. Avec qui partageons-nous vos données ?' },
  { type: 'table',
    headers: ['Sous-traitant', 'Pays', 'Données transmises', 'Finalité'],
    rows: [
      ['osteo-upgrade.fr', 'France', 'Email, device_id, token', 'Vérification de licence'],
      ['Supabase', 'UE', 'Aucune donnée personnelle', 'Contenu e-learning (lecture seule)'],
      ['Cloudflare Workers', 'UE', 'Tokens + réponses sondages', 'Transit temporaire des sondages'],
      ['Resend', 'UE', 'Email + nom du destinataire (si SMTP non configuré)', "Envoi d'emails : rapport comptable, rappels, messages patients (fallback SMTP)"],
      ['Groq', 'États-Unis', 'Enregistrement audio (dictée IA MyOsteoFlow uniquement)', 'Transcription vocale via Whisper large-v3-turbo'],
      ['Anthropic', 'États-Unis', 'Texte transcrit (dictée IA et aide au raisonnement clinique)', "Structuration automatique de l'anamnèse et suggestions cliniques"],
    ],
  },
  { type: 'p', content: "Aucun de ces sous-traitants n'a accès aux données patients stockées localement. Groq et Anthropic ne sont sollicités que lorsque l'Utilisateur utilise activement les fonctionnalités IA." },

  { type: 'h2', content: '4. Durée de conservation' },
  { type: 'ul', items: [
    "**Données de licence** : conservées pendant la durée de l'abonnement, puis supprimées dans un délai de 30 jours après résiliation.",
    "**Données patients** : stockées localement, sous la responsabilité de l'Utilisateur, conformément aux durées légales (articles L. 1142-28 et R. 1112-7 du Code de la santé publique).",
    "**Réponses aux sondages** : supprimées du service intermédiaire dès la synchronisation locale (vérifiée automatiquement toutes les 10 minutes lorsque le Logiciel est ouvert), et au plus tard 30 jours après réception en cas d'absence de synchronisation.",
    "**Données de dictée vocale** : l'audio et le texte transcrit ne sont pas conservés par l'Éditeur après traitement. Les durées de conservation chez Groq et Anthropic sont régies par leurs politiques respectives.",
  ]},

  { type: 'h2', content: '5. Vos droits' },
  { type: 'p', content: "Conformément au RGPD et à la loi Informatique et Libertés, vous disposez des droits suivants concernant vos données de licence :" },
  { type: 'ul', items: [
    "**Droit d'accès** : obtenir une copie des données vous concernant.",
    "**Droit de rectification** : corriger des données inexactes.",
    "**Droit à l'effacement** : demander la suppression de vos données.",
    "**Droit à la portabilité** : recevoir vos données dans un format structuré.",
    "**Droit d'opposition** : vous opposer à certains traitements.",
  ]},
  { type: 'p', content: "Pour exercer ces droits : **contact@osteo-upgrade.fr** — Vous disposez également du droit d'introduire une réclamation auprès de la **CNIL** (www.cnil.fr)." },

  { type: 'h2', content: '6. Sécurité' },
  { type: 'p', content: "L'Éditeur met en œuvre des mesures techniques et organisationnelles appropriées pour protéger les données de licence (HTTPS, tokens à durée limitée). Les données patients étant stockées localement dans MyOsteoFlow, leur sécurité physique relève de la responsabilité de l'Utilisateur." },

  { type: 'h2', content: '7. Modifications' },
  { type: 'p', content: "Cette politique peut être mise à jour. En cas de modification substantielle, l'Utilisateur en sera informé lors de l'ouverture du Logiciel ou de sa prochaine connexion au Site." },
]
