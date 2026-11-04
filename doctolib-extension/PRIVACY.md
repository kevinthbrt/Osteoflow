# Politique de confidentialité de l'extension « Osteoflow : import Doctolib »

Version publiée : https://www.osteo-upgrade.fr/politique-confidentialite/extension-doctolib
(page du site OsteoUpgrade, à garder identique à ce fichier).

Dernière mise à jour : 4 novembre 2026

Cette extension est éditée par SAS OsteoUpgrade, éditeur du logiciel
MyOsteoFlow. Elle est indépendante de Doctolib et n'est ni affiliée à
Doctolib, ni approuvée par Doctolib.

## À quoi sert l'extension

Elle permet à un praticien qui utilise Doctolib Pro et MyOsteoFlow de copier
les rendez-vous d'un jour de son agenda Doctolib vers « Ma journée » de
MyOsteoFlow, installé sur son propre ordinateur. C'est sa seule fonction.

## Données traitées

Quand le praticien clique sur « Envoyer les rendez-vous », et seulement à ce
moment, l'extension lit dans son agenda Doctolib Pro, avec sa session déjà
ouverte, les rendez-vous du jour qu'il a choisi. Elle conserve uniquement :

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
praticien, en attente de sa validation. Rien n'est ajouté sans son accord.

L'extension garde seulement dans le navigateur, sur l'ordinateur du praticien,
ses réglages : le code d'appairage avec MyOsteoFlow et, s'il est renseigné,
l'identifiant de l'agenda Doctolib.

## Ce que l'extension ne fait pas

- Elle ne vend, ne loue et ne partage aucune donnée.
- Elle n'utilise aucun outil de mesure d'audience, de publicité ou de suivi.
- Elle ne lit rien en dehors de `pro.doctolib.fr`, et rien sans clic du
  praticien.
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
