# Osteoflow : import Doctolib

Extension Chrome (et Edge) qui envoie les rendez-vous d'un jour de l'agenda
Doctolib Pro vers « Ma journée » d'Osteoflow.

Outil indépendant, non affilié à Doctolib.

## Ce qu'elle fait, et ne fait pas

- Elle ne s'active que sur `pro.doctolib.fr`, et seulement quand on clique
  sur « Envoyer les rendez-vous ».
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

1. Dans Osteoflow, ouvrir **Ma journée**, puis « Code de l'extension », et
   copier le code.
2. Cliquer sur l'icône de l'extension, ouvrir « Réglages », coller le code,
   puis « Enregistrer ».
3. Ouvrir l'agenda sur `pro.doctolib.fr`. S'il était déjà ouvert avant
   l'installation, recharger la page (F5).

## Au quotidien

1. Agenda Doctolib ouvert, cliquer sur l'icône de l'extension.
2. Choisir le jour (aujourd'hui par défaut), puis « Envoyer les rendez-vous ».
3. Dans Osteoflow, Ma journée : vérifier l'association de chaque rendez-vous
   et cliquer sur « Ajouter à la journée ».

## Points techniques

- Les rendez-vous viennent de `pro.doctolib.fr/calendar_display/appointments`,
  appelé comme le fait l'agenda lui-même. Si Doctolib change ce format,
  l'extension affichera « Réponse Doctolib inattendue » : il faudra l'adapter.
- L'identifiant d'agenda est repéré automatiquement dans les requêtes de
  l'agenda affiché. Il peut être forcé dans les Réglages.
- Le code d'appairage protège Osteoflow : sans lui, aucun site ne peut lui
  envoyer de rendez-vous. Un nouveau code peut être généré dans Ma journée.
