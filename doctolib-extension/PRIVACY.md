# Politique de confidentialité de l'extension « Osteoflow : import Doctolib »

Version publiée : https://www.osteo-upgrade.fr/politique-confidentialite/extension-doctolib
(page du site OsteoUpgrade, à garder identique à ce fichier).

Dernière mise à jour : 5 novembre 2026

Cette extension est éditée par SAS OsteoUpgrade, éditeur du logiciel
MyOsteoFlow. Elle est indépendante de Doctolib et n'est ni affiliée à
Doctolib, ni approuvée par Doctolib.

## À quoi sert l'extension

Elle permet à un praticien qui utilise Doctolib Pro et MyOsteoFlow de copier
les rendez-vous de son agenda Doctolib (la semaine en cours, ou un jour qu'il
choisit) vers « Ma journée » et l'agenda de MyOsteoFlow, installé sur son
propre ordinateur. C'est sa seule fonction.

## Données traitées

Tant que l'agenda Doctolib Pro est ouvert dans le navigateur, l'extension lit,
avec la session déjà ouverte, les rendez-vous de la semaine en cours : à
l'ouverture de l'agenda, puis toutes les 10 minutes. Le praticien peut
désactiver cette synchronisation automatique dans les réglages de
l'extension : elle ne lit alors l'agenda que lorsqu'il clique sur
« Synchroniser » ou « Envoyer ce jour ». Elle conserve uniquement :

- l'identifiant, le type, le statut, l'heure de début et de fin du rendez-vous ;
- le prénom, le nom, le nom de naissance, la date de naissance, le sexe, le
  téléphone et l'adresse email du patient.

Les notes du rendez-vous, l'adresse postale du patient et toute autre
information de l'agenda ne sont pas reprises.

Ces informations peuvent constituer des données de santé : elles révèlent
qu'une personne consulte un professionnel de santé.

## Où vont les données

Les données vont **directement de l'onglet Doctolib du praticien à
MyOsteoFlow sur le même ordinateur** (adresse `localhost`). Elles ne
transitent par aucun serveur de l'éditeur ni d'un tiers. L'éditeur n'y a pas
accès.

Dans MyOsteoFlow, elles sont enregistrées dans la base de données locale du
praticien. Si le praticien a laissé l'option active, les patients reconnus
avec certitude (nom, prénom et date de naissance identiques à un dossier
existant) sont ajoutés à « Ma journée » ; les autres rendez-vous attendent sa
validation. Aucun dossier patient n'est créé sans son accord. Les rendez-vous
de plus de trois semaines sont effacés de cette copie locale.

L'extension garde seulement dans le navigateur, sur l'ordinateur du praticien,
ses réglages : le code d'appairage et l'adresse locale de MyOsteoFlow, ses
préférences (synchronisation automatique, affichage du bouton) et, s'il est
renseigné, l'identifiant de l'agenda Doctolib.

## Ce que l'extension ne fait pas

- Elle ne vend, ne loue et ne partage aucune donnée.
- Elle n'utilise aucun outil de mesure d'audience, de publicité ou de suivi.
- Elle ne lit rien en dehors de `pro.doctolib.fr`, et seulement les
  rendez-vous de l'agenda, quand le praticien l'a ouvert.
- Elle ne connaît ni l'identifiant ni le mot de passe Doctolib.

## Responsabilités

Pour les données de ses patients, le praticien reste responsable du
traitement au sens du RGPD. L'extension est un outil qu'il utilise sur son
propre poste, pour la gestion de ses rendez-vous.

## Désinstallation

La suppression de l'extension depuis la page des extensions du navigateur
efface ses réglages. Les rendez-vous déjà importés restent dans MyOsteoFlow,
où le praticien peut les supprimer.

## Contact

SAS OsteoUpgrade, 57 bis route nationale, résidence coté parc, bât A,
06440 Blausasc, France. Email : contact@osteo-upgrade.fr
