# MyOsteoFlow, synchro d’agenda pour Doctolib

Extension Chrome (et Edge) qui envoie les rendez-vous d'un jour de l'agenda
Doctolib Pro vers « Ma journée » d'MyOsteoFlow.

Outil indépendant, non affilié à Doctolib.

## Ce qu'elle fait, et ne fait pas

- Elle ne s'active que sur `pro.doctolib.fr`. Tant que l'agenda y est
  ouvert, elle synchronise la semaine en cours avec MyOsteoFlow : à
  l'ouverture, puis toutes les 10 minutes (au plus une fois toutes les
  4 minutes, quel que soit le nombre d'onglets). Désactivable dans ses
  Réglages ; le bouton « MyOsteoFlow » en bas à droite de l'agenda synchronise
  à la demande.
- Elle lit les rendez-vous avec la session Doctolib déjà ouverte, sans
  identifiants ni mot de passe.
- Elle ne garde que l'utile : heure, statut, nom, prénom, nom de naissance,
  date de naissance, sexe, téléphone et email du patient.
- Elle envoie ces données **uniquement à MyOsteoFlow sur le poste**
  (`localhost`, ports 3456 à 3465). Aucun serveur extérieur, aucun suivi.
- Dans MyOsteoFlow, les patients reconnus avec certitude (nom, prénom, date de
  naissance) sont ajoutés à Ma journée (option dans Réglages, Doctolib) ; un
  rendez-vous annulé ou déplacé retire le patient ajouté s'il n'a pas encore
  été vu. Le reste attend une validation dans Ma journée. Aucun dossier n'est
  créé sans clic. L'agenda de la semaine s'affiche sur le tableau de bord.

## Installation pour les tests (mode développeur)

1. Dans Chrome, ouvrir `chrome://extensions` (Edge : `edge://extensions`).
2. Activer le « Mode développeur ».
3. Cliquer sur « Charger l'extension non empaquetée » et choisir ce dossier
   `doctolib-extension`.
4. Épingler l'extension (icône puzzle, puis punaise).

## Première utilisation

Rien à saisir : MyOsteoFlow ouvert, l'extension s'y connecte toute seule dès
l'installation (elle demande le code d'appairage à MyOsteoFlow sur le poste).
Ma journée et Réglages, Intégrations, Doctolib affichent alors « Extension
connectée ». Si l'agenda Doctolib était déjà ouvert, recharger la page (F5).

En cas d'échec (MyOsteoFlow fermé, port inhabituel), le code reste saisissable
à la main : Réglages de l'extension, champ « Code d'appairage ».

## Au quotidien

1. Ouvrir l'agenda Doctolib dans Chrome, comme d'habitude : la semaine se
   synchronise toute seule.
2. MyOsteoFlow prévient quand des patients ont été ajoutés ou sont à vérifier.
3. Dans Ma journée, valider les rendez-vous à vérifier (homonymes, nouveaux
   patients). L'icône de l'extension permet aussi d'envoyer un autre jour.

## Points techniques

- Les rendez-vous viennent de `pro.doctolib.fr/calendar_display/appointments`,
  appelé comme le fait l'agenda lui-même. Si Doctolib change ce format,
  l'extension affichera « Réponse Doctolib inattendue » : il faudra l'adapter.
- L'identifiant d'agenda est repéré automatiquement dans les requêtes de
  l'agenda affiché. Il peut être forcé dans les Réglages.
- Le code d'appairage protège MyOsteoFlow : sans lui, aucun site ne peut lui
  envoyer de rendez-vous. Seule l'interface d'MyOsteoFlow et l'extension
  (autorisée sur localhost) peuvent le lire ; un site web en est empêché par
  le navigateur. Un nouveau code peut être généré dans Réglages, Doctolib :
  l'extension le reprend seule.
- `background.js` est le seul fichier qui parle à MyOsteoFlow ; `content.js`
  lit l'agenda et affiche le bouton ; `popup.js` est la fenêtre de l'icône.
