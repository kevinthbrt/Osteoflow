# Publication sur le Chrome Web Store

Textes prêts à coller dans le formulaire de Google, et liste de ce qu'il
faut avoir sous la main.

## Avant de commencer

- Un compte Google dédié de préférence (celui de la société), pour que la
  publication ne dépende pas d'une personne.
- L'archive `doctolib-extension.zip` : `npm run extension:zip` à la racine
  du projet.
- La politique de confidentialité en ligne :
  https://www.osteo-upgrade.fr/politique-confidentialite/extension-doctolib
  (page du site OsteoUpgrade, même texte que `PRIVACY.md`).
- Deux captures d'écran au format 1280 × 800 : dossier `store/`.

## Onglet « Fiche Play Store » (Store listing)

**Nom** (repris du manifest) : MyOsteoFlow, synchro d’agenda pour Doctolib

**Résumé** (132 caractères maximum, repris du manifest) :
Envoie les rendez-vous de votre agenda Doctolib Pro vers MyOsteoFlow, sur votre poste. Outil indépendant, non affilié à Doctolib.

**Description** :

```
Pour les praticiens qui utilisent Doctolib Pro et MyOsteoFlow.

Votre agenda Doctolib ouvert, la semaine se synchronise toute seule avec MyOsteoFlow : les patients reconnus arrivent dans « Ma journée », et l'agenda de la semaine s'affiche sur l'accueil.

Aucun réglage : l'extension se connecte toute seule à MyOsteoFlow ouvert sur le même ordinateur.

• Les patients déjà suivis sont reconnus automatiquement (nom, prénom, nom de naissance, date de naissance).
• En cas de doute, MyOsteoFlow vous demande de choisir le bon dossier.
• Les nouveaux patients sont créés avec les informations Doctolib, après votre validation.

Confidentialité
• Les rendez-vous vont directement de votre onglet Doctolib à MyOsteoFlow sur votre ordinateur. Aucun serveur intermédiaire, aucun suivi.
• Seuls l'heure, le statut et l'identité du patient sont repris. Les notes et l'adresse ne le sont pas.
• L'extension n'agit que sur pro.doctolib.fr : elle lit les rendez-vous de la semaine quand l'agenda est ouvert (synchronisation automatique désactivable) et y affiche un petit bouton pour synchroniser à la demande.

Prérequis : MyOsteoFlow ouvert sur le même ordinateur, et un compte Doctolib Pro.

Outil indépendant, non affilié à Doctolib et non approuvé par Doctolib.
```

**Catégorie** : Outils (ou « Workflow et planification » si proposée)

**Langue** : Français

**Icône** : `icons/icon-128.png`

**Captures d’écran** : `store/capture-1.png`, `store/capture-2.png` et `store/capture-3.png` (1280 × 800, données fictives)

## Onglet « Pratiques de confidentialité » (Privacy practices)

**Objectif unique** (Single purpose) :

```
Copier les rendez-vous de l'agenda Doctolib Pro du praticien vers le logiciel MyOsteoFlow installé sur son ordinateur.
```

**Justification de « storage »** :

```
Conserver les réglages de l'extension sur le poste : le code d'appairage avec MyOsteoFlow, l'adresse locale de MyOsteoFlow, les préférences (synchronisation automatique, bouton dans l'agenda), l'heure de la dernière synchronisation et, si le praticien le renseigne, l'identifiant de son agenda Doctolib.
```

**Justification de l'accès à pro.doctolib.fr** :

```
Lire, avec la session ouverte du praticien, les rendez-vous de la semaine en cours dans son agenda Doctolib Pro quand il l'a ouvert (à l'ouverture puis toutes les 10 minutes, désactivable), et afficher un bouton pour synchroniser à la demande. L'extension n'agit sur aucun autre site.
```

**Justification de l'accès à localhost et 127.0.0.1** :

```
Se connecter au logiciel MyOsteoFlow installé sur le même ordinateur, qui écoute sur localhost (ports 3456 à 3465), et lui envoyer ces rendez-vous. Les données ne quittent pas le poste.
```

**Code distant** : Non, aucun code distant n'est utilisé.

**Données collectées** : cocher
- Informations permettant d'identifier une personne (nom, email, téléphone, date de naissance) ;
- Informations de santé (le rendez-vous chez un professionnel de santé).

Puis cocher les trois engagements : pas de vente ni de transfert à des tiers
hors des cas autorisés, pas d'usage étranger à l'objectif unique, pas d'usage
pour évaluer la solvabilité.

**Politique de confidentialité** :
https://www.osteo-upgrade.fr/politique-confidentialite/extension-doctolib

## Onglet « Distribution »

- **Visibilité** : « Non répertoriée » (Unlisted) pour la réserver aux
  utilisateurs qui ont le lien, au moins au début.
- **Pays** : tous, ou France, Belgique, Suisse, Canada selon les utilisateurs.

## Après la validation par Google

1. Copier l'adresse de l'extension sur le Chrome Web Store.
2. Dans `src/lib/doctolib/config.ts` : `DOCTOLIB_EXTENSION_PUBLISHED = true`
   et `DOCTOLIB_EXTENSION_STORE_URL = '<adresse>'`. La mise en route (Ma journée, Réglages, Intégrations, Doctolib) apparaît
   alors pour tous les utilisateurs, avec le bouton « Installer l'extension ».

## Mettre à jour l'extension

1. Augmenter `version` dans `manifest.json` (1.0.0, puis 1.0.1…).
2. `npm run extension:zip`, puis « Importer un nouveau package » sur la page
   de l'extension dans la console développeur.
3. Les utilisateurs reçoivent la mise à jour automatiquement après validation.
