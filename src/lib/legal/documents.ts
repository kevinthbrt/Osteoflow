export const CGU_VERSION = '1.1'
export const CGU_DATE = '20 mai 2026'

export interface LegalSection {
  type: 'h1' | 'h2' | 'h3' | 'p' | 'ul' | 'table' | 'hr'
  content?: string
  items?: string[]
  headers?: string[]
  rows?: string[][]
}

export const CGU_SECTIONS: LegalSection[] = [
  { type: 'h1', content: "Conditions Générales d'Utilisation — MyOsteoFlow" },
  { type: 'p', content: `**Version ${CGU_VERSION} — En vigueur depuis le ${CGU_DATE}**` },
  { type: 'hr' },

  { type: 'h2', content: 'Article 1 – Objet' },
  { type: 'p', content: "Les présentes Conditions Générales d'Utilisation (« CGU ») régissent l'accès et l'utilisation du logiciel **MyOsteoFlow** (ci-après « le Logiciel »), édité par la société **SAS Osteoupgrade** (ci-après « l'Éditeur »)." },
  { type: 'p', content: "MyOsteoFlow est un logiciel de bureau destiné aux ostéopathes professionnels pour la gestion de leur cabinet : suivi des patients, rédaction de comptes-rendus de consultation, facturation et statistiques." },

  { type: 'h2', content: 'Article 2 – Définitions' },
  { type: 'ul', items: [
    "**Utilisateur** : tout ostéopathe professionnel ayant souscrit un abonnement Osteoupgrade Premium et installé le Logiciel.",
    "**Données Patients** : toute information saisie dans le Logiciel concernant les patients de l'Utilisateur (données d'identité, antécédents médicaux, comptes-rendus de consultations).",
    "**Données de Licence** : email, identifiant d'appareil et jeton d'authentification utilisés pour vérifier la validité de l'abonnement.",
    "**Responsable de traitement** : l'Utilisateur, en qualité de professionnel de santé exploitant le Logiciel pour le compte de son cabinet.",
    "**Sous-traitant** : l'Éditeur, qui fournit le Logiciel en tant qu'outil de traitement.",
  ]},

  { type: 'h2', content: 'Article 3 – Accès au Logiciel' },
  { type: 'p', content: "L'accès au Logiciel est conditionné à la détention d'un abonnement **Osteoupgrade Premium** en cours de validité. La licence est personnelle, non transférable et limitée à l'appareil enregistré lors de l'activation." },
  { type: 'p', content: "L'Éditeur se réserve le droit de suspendre l'accès en cas de résiliation ou d'expiration de l'abonnement, de tentative de contournement de la protection de licence ou de violation des présentes CGU." },

  { type: 'h2', content: 'Article 4 – Données Personnelles et Accord de Sous-traitance (DPA)' },

  { type: 'h3', content: '4.1 Données Patients — stockage local' },
  { type: 'p', content: "Les données relatives aux patients de l'Utilisateur sont stockées **exclusivement en local** sur l'appareil de l'Utilisateur, dans une base de données SQLite. **L'Éditeur n'a accès à aucune donnée patient.**" },
  { type: 'p', content: "En tant que responsable de traitement au sens du RGPD (Règlement UE 2016/679), il appartient à l'Utilisateur de :" },
  { type: 'ul', items: [
    "informer ses patients du traitement de leurs données (Article 13 RGPD) ;",
    "garantir la sécurité physique de l'appareil sur lequel le Logiciel est installé ;",
    "effectuer des sauvegardes régulières (voir Article 5.2) ;",
    "respecter les durées de conservation légales applicables aux dossiers médicaux.",
  ]},

  { type: 'h3', content: '4.2 Données de Licence' },
  { type: 'p', content: "Dans le seul but de valider l'abonnement, le Logiciel transmet à l'Éditeur, via des appels API sécurisés (HTTPS) : l'adresse email du compte Osteoupgrade, un identifiant unique de l'appareil, et un jeton d'authentification. Ces données sont traitées sur la base de l'exécution du contrat d'abonnement et ne sont pas utilisées à d'autres fins." },

  { type: 'h3', content: '4.3 Sondages de satisfaction patient' },
  { type: 'p', content: "Le Logiciel propose optionnellement l'envoi de sondages de satisfaction aux patients. Les réponses (note globale, score EVA, commentaire) transitent temporairement par un service Cloudflare Workers hébergé en Europe avant d'être synchronisées en local et supprimées du service intermédiaire. L'Utilisateur est responsable d'informer ses patients de cette fonctionnalité avant de l'activer." },

  { type: 'h3', content: '4.4 Contenu e-learning' },
  { type: 'p', content: "Le Logiciel accède à des contenus pédagogiques (topographies anatomiques) hébergés sur Supabase. Aucune donnée patient n'est transmise dans ce cadre." },

  { type: 'h3', content: '4.5 Rapports comptables' },
  { type: 'p', content: "Si l'Utilisateur active l'envoi de rapport comptable, un PDF contenant les données financières du cabinet est transmis à l'adresse email de l'expert-comptable renseignée par l'Utilisateur, via le service Resend. Aucune donnée patient identifiable n'est incluse." },

  { type: 'h3', content: '4.6 Dictée intelligente (fonctionnalité IA)' },
  { type: 'p', content: "Le Logiciel propose optionnellement une fonctionnalité de dictée vocale assistée par intelligence artificielle permettant de structurer automatiquement l'anamnèse d'une consultation. Lorsque l'Utilisateur active cette fonctionnalité :" },
  { type: 'ul', items: [
    "la transcription vocale est réalisée localement par le navigateur (API Web Speech, service Google) et n'est pas conservée par l'Éditeur ;",
    "le texte transcrit est transmis à Anthropic (États-Unis) via un proxy sécurisé exploité par l'Éditeur (Osteoupgrade), aux fins de structuration du contenu clinique ;",
    "**aucune donnée identifiant le patient** (nom, prénom, date de naissance, numéro de sécurité sociale) ne doit figurer dans la dictée — l'Utilisateur en est seul responsable ;",
    "Anthropic peut conserver les données transmises conformément à sa politique de confidentialité ; l'Éditeur recommande de consulter celle-ci sur anthropic.com ;",
    "l'utilisation de cette fonctionnalité est entièrement facultative et n'affecte pas le fonctionnement du reste du Logiciel.",
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
  { type: 'p', content: "Le Logiciel est fourni « en l'état ». L'Éditeur s'engage à maintenir le Logiciel en conditions opérationnelles et à corriger les anomalies signalées dans des délais raisonnables. La responsabilité de l'Éditeur ne peut être engagée en cas de perte de données due à une défaillance matérielle de l'appareil de l'Utilisateur, de dommage indirect, perte d'exploitation ou manque à gagner." },

  { type: 'h3', content: "5.2 Sauvegardes — responsabilité de l'Utilisateur" },
  { type: 'p', content: "Les données étant stockées localement, **l'Utilisateur est seul responsable de la réalisation de sauvegardes régulières** sur un support externe (clé USB, disque externe, cloud personnel). L'Éditeur recommande une sauvegarde hebdomadaire a minima. Le Logiciel propose un outil de sauvegarde dans les paramètres à cette fin." },

  { type: 'h3', content: '5.3 Contenu médical' },
  { type: 'p', content: "Les outils d'aide au diagnostic intégrés au Logiciel (arbres décisionnels) sont fournis à titre indicatif et ne se substituent en aucun cas au jugement clinique du praticien. L'Éditeur décline toute responsabilité quant aux décisions thérapeutiques prises par l'Utilisateur." },

  { type: 'h2', content: 'Article 6 – Propriété intellectuelle' },
  { type: 'p', content: "Le Logiciel, son code source, son interface et ses contenus pédagogiques sont la propriété exclusive de l'Éditeur. La licence accordée est limitée à l'usage professionnel personnel de l'Utilisateur. Toute reproduction, modification ou redistribution est interdite sans autorisation écrite préalable." },

  { type: 'h2', content: 'Article 7 – Modifications des CGU' },
  { type: 'p', content: "L'Éditeur se réserve le droit de modifier les présentes CGU. En cas de modification substantielle, l'Utilisateur en sera informé lors de l'ouverture du Logiciel et devra accepter les nouvelles conditions pour continuer à utiliser le Logiciel." },

  { type: 'h2', content: 'Article 8 – Résiliation' },
  { type: 'p', content: "L'accès au Logiciel prend fin automatiquement en cas de résiliation ou d'expiration de l'abonnement Osteoupgrade. Les données stockées localement restent accessibles à l'Utilisateur, qui en est propriétaire." },

  { type: 'h2', content: 'Article 9 – Droit applicable et juridiction' },
  { type: 'p', content: "Les présentes CGU sont régies par le droit français. Tout litige relatif à leur interprétation ou à leur exécution sera soumis aux tribunaux compétents du ressort du siège social de l'Éditeur." },
]

export const PRIVACY_SECTIONS: LegalSection[] = [
  { type: 'h1', content: 'Politique de Confidentialité — MyOsteoFlow' },
  { type: 'p', content: `**Version ${CGU_VERSION} — En vigueur depuis le ${CGU_DATE}**` },
  { type: 'hr' },

  { type: 'h2', content: '1. Qui sommes-nous ?' },
  { type: 'p', content: "MyOsteoFlow est édité par la **SAS Osteoupgrade**. Pour toute question relative à la protection de vos données : **contact@osteo-upgrade.fr**" },

  { type: 'h2', content: '2. Quelles données sont traitées et pourquoi ?' },

  { type: 'h3', content: "2.1 Données de l'Utilisateur (l'ostéopathe)" },
  { type: 'table',
    headers: ['Données', 'Finalité', 'Base légale'],
    rows: [
      ['Email + mot de passe Osteoupgrade', 'Authentification et vérification de la licence', 'Exécution du contrat'],
      ["Identifiant de l'appareil", 'Gestion des licences par appareil', 'Exécution du contrat'],
      ["Jeton d'authentification", "Vérification périodique de la validité de l'abonnement", 'Exécution du contrat'],
    ],
  },

  { type: 'h3', content: "2.2 Données des patients de l'Utilisateur" },
  { type: 'p', content: "Les données des patients (identité, coordonnées, antécédents, comptes-rendus) sont stockées **exclusivement en local** sur l'appareil de l'Utilisateur. Elles ne sont **jamais transmises** aux serveurs de l'Éditeur. L'ostéopathe est le responsable de traitement au sens du RGPD pour ces données." },

  { type: 'h3', content: '2.3 Données des sondages de satisfaction' },
  { type: 'p', content: "Si l'Utilisateur active l'envoi de sondages, les réponses des patients transitent temporairement par un service Cloudflare Workers. Ces réponses sont synchronisées en local puis **supprimées du service intermédiaire** dans les 24 heures suivant la synchronisation." },

  { type: 'h2', content: '3. Avec qui partageons-nous vos données ?' },
  { type: 'table',
    headers: ['Sous-traitant', 'Pays', 'Données transmises', 'Finalité'],
    rows: [
      ['osteo-upgrade.fr', 'France', 'Email, device_id, token', 'Vérification de licence'],
      ['Supabase', 'UE', 'Aucune donnée personnelle', 'Contenu e-learning (lecture seule)'],
      ['Cloudflare Workers', 'UE', 'Tokens + réponses sondages', 'Transit temporaire des sondages'],
      ['Resend', 'UE', 'Données financières du cabinet (à la demande)', 'Envoi de rapport à l\'expert-comptable'],
    ],
  },
  { type: 'p', content: "Aucun de ces sous-traitants n'a accès aux données patients stockées localement." },

  { type: 'h2', content: '4. Durée de conservation' },
  { type: 'ul', items: [
    "**Données de licence** : conservées pendant la durée de l'abonnement, puis supprimées dans un délai de 30 jours après résiliation.",
    "**Données patients** : stockées localement, sous la responsabilité de l'Utilisateur, conformément aux durées légales (articles L. 1142-28 et R. 1112-7 du Code de la santé publique).",
    "**Réponses aux sondages** : supprimées du service intermédiaire sous 24h après synchronisation.",
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
  { type: 'p', content: "L'Éditeur met en œuvre des mesures techniques et organisationnelles appropriées pour protéger les données de licence (HTTPS, tokens à durée limitée). Les données patients étant stockées localement, leur sécurité physique relève de la responsabilité de l'Utilisateur." },

  { type: 'h2', content: '7. Modifications' },
  { type: 'p', content: "Cette politique peut être mise à jour. En cas de modification substantielle, l'Utilisateur en sera informé lors de l'ouverture du Logiciel." },
]
