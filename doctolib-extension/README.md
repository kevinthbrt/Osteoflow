# Osteoflow : import Doctolib

Extension Chrome (et Edge) qui envoie les rendez-vous d'un jour de l'agenda
Doctolib Pro vers « Ma journée » d'Osteoflow.

Outil indépendant, non affilié à Doctolib.

## Ce qu'elle fait, et ne fait pas

- Elle ne s'active que sur `pro.doctolib.fr`, et seulement quand on clique
  sur « Envoyer à Osteoflow » (bouton en bas à droite de l'agenda, ou icône
  de l'extension).
- Elle lit les rendez-vous du jour choisi avec la session Doctolib déjà
  ouverte, sans identifiants ni mot de passe.
- Elle ne garde que l'utile : heure, statut, nom, prénom, nom de naissance,
  date de naissance, sexe, téléphone et email du patient.
- Elle envoie ces données **uniquement à Osteoflow sur le poste**
  (`localhost`, ports 3456 à 3465). Aucun serveur extérieur, aucun suivi.
- Osteoflow n'ajoute rien tout seul : les rendez-vous attendent dans Ma
  journée, où le praticien valide l'association à chaque dossier.

## Installation pour les tests (mode développeur)

1. Dans Chrome, ouvrir `chrome://extensions` (Edge : `edge://extensions`).
2. Activer le « Mode développeur ».
3. Cliquer sur « Charger l'extension non empaquetée » et choisir ce dossier
   `doctolib-extension`.
4. Épingler l'extension (icône puzzle, puis punaise).

## Première utilisation

Rien à saisir : Osteoflow ouvert, l'extension s'y connecte toute seule dès
l'installation (elle demande le code d'appairage à Osteoflow sur le poste).
Ma journée et Réglages, Intégrations, Doctolib affichent alors « Extension
connectée ». Si l'agenda Doctolib était déjà ouvert, recharger la page (F5).

En cas d'échec (Osteoflow fermé, port inhabituel), le code reste saisissable
à la main : Réglages de l'extension, champ « Code d'appairage ».

## Au quotidien

1. Agenda Doctolib ouvert, cliquer sur « Envoyer à Osteoflow » en bas à
   droite (jour affiché en vue jour, sinon aujourd'hui). L'icône de
   l'extension permet de choisir un autre jour.
2. Osteoflow prévient de l'arrivée des rendez-vous, où que l'on soit.
3. Dans Ma journée : vérifier l'association de chaque rendez-vous et cliquer
   sur « Ajouter à la journée ».

## Points techniques

- Les rendez-vous viennent de `pro.doctolib.fr/calendar_display/appointments`,
  appelé comme le fait l'agenda lui-même. Si Doctolib change ce format,
  l'extension affichera « Réponse Doctolib inattendue » : il faudra l'adapter.
- L'identifiant d'agenda est repéré automatiquement dans les requêtes de
  l'agenda affiché. Il peut être forcé dans les Réglages.
- Le code d'appairage protège Osteoflow : sans lui, aucun site ne peut lui
  envoyer de rendez-vous. Seule l'interface d'Osteoflow et l'extension
  (autorisée sur localhost) peuvent le lire ; un site web en est empêché par
  le navigateur. Un nouveau code peut être généré dans Réglages, Doctolib :
  l'extension le reprend seule.
- `background.js` est le seul fichier qui parle à Osteoflow ; `content.js`
  lit l'agenda et affiche le bouton ; `popup.js` est la fenêtre de l'icône.
