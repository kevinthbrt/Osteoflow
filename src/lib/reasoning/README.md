# Moteur de raisonnement clinique

Aide au **raisonnement**, pas au diagnostic : le moteur ne conclut jamais seul.
Il tient un différentiel, dit sur quoi chaque hypothèse s'appuie, ce qui reste
à explorer, et ce qu'il serait le plus utile de chercher ensuite.

## Le principe

Deux responsabilités séparées, et cette séparation est le cœur du dispositif :

- **L'IA perçoit.** Elle transcrit et traduit l'anamnèse en signaux du
  vocabulaire fermé (`signals.ts`). Elle ne raisonne pas, elle ne conclut pas.
- **Le moteur raisonne.** Des règles déterministes, versionnées et testées
  (`engine.ts` + `knowledge/`) transforment les signaux en hypothèses. Deux
  passages sur la même anamnèse donnent le même résultat, et chaque conclusion
  est traçable jusqu'aux signaux qui l'ont produite.

## Les pièces

| Fichier | Rôle |
|---|---|
| `signals.ts` | Vocabulaire fermé des faits cliniques. Rien d'autre n'est interprétable. |
| `types.ts` | Types du moteur : expressions, critères, hypothèses, actions. |
| `engine.ts` | Évaluation ternaire, cotation, classement, choix des prochaines actions. |
| `knowledge/` | Une base de connaissance par région. C'est de la donnée, pas du code. |
| `sources.ts` | Bibliographie. Toute valeur chiffrée y renvoie par une clé typée. |
| `bridge.ts` | Traduit un parcours d'arbre décisionnel en signaux. |
| `legacy/` | Logique des arbres historiques, extraite des composants. Sert de référence. |

## Source de vérité

La région lombaire suit le document de référence **« Base lombaire — moteur
d'anamnèse »**, qui en spécifie l'architecture en quatre couches :

1. **Filtre drapeaux rouges** — bloque toute conclusion de prise en charge
   manuelle. Le champ de compétence s'arrête ici.
2. **Classification en trois catégories** — non spécifique, radiculaire,
   cause spécifique.
3. **Sous-typage pondéré** par accumulation de signes congruents.
4. **Stratification psychosociale** — pronostic, pas diagnostic.

Chaque valeur du document a été remontée à sa publication primaire avant d'être
codée. Deux attributions s'y sont révélées fausses et sont rectifiées dans
`sources.ts` : le modèle RAPIDH revient à Genevay et al. (Spine J 2017) et non à
Chiodo & Jorgensen 2025, et la revue Cochrane 2023 des drapeaux rouges a pour
premier auteur Han CS, non Williams. Le champ `verification` de chaque entrée
dit si la source primaire a été consultée (`primaire`), corrigée (`corrigee`),
ou reste à consulter (`document`).

## Les cinq règles de calibration

Elles viennent du chapitre 8 du document et sont appliquées par le moteur, pas
par la base de connaissance. Une base mal écrite ne peut donc pas les contourner.

1. **Chaînage des cotes, jamais d'addition de points arbitraires.** Un poids est
   un rapport de vraisemblance ; le score additif n'est que son logarithme.
2. **Paliers d'informativité.** Un rapport compris entre 0,5 et 2 ne pèse pas.
   C'est cette seule règle qui fait qu'un Lasègue positif ne confirme rien
   (LR+ 1,28) alors qu'un Lasègue négatif écarte (LR− 0,29).
3. **Pas de rapport négatif sur un drapeau rouge.** Un dépistage négatif
   n'abaisse jamais la probabilité d'une pathologie grave : le moteur ne
   rassure pas, il franchit ou non un seuil d'alerte.
4. **Le cluster prime sur le produit des rapports corrélés.** Les signes
   lombaires ne sont pas conditionnellement indépendants ; au sein d'un groupe
   `correlation`, une seule contribution est retenue.
5. **Trois niveaux d'alerte, pas un score continu.** `immediate`, `elevee`,
   `vigilance` — sur une prévalence de quelques pour mille, un pourcentage
   inviterait à temporiser.

Deux corollaires portés par les types : le diagnostic d'exclusion
(`kind: 'exclusion'`) ne se score jamais — il est ce qui reste, pas ce qui
gagne — et la stratification pronostique (`kind: 'profil'`) sort du différentiel,
parce qu'un risque de chronicisation ne concourt pas avec une hernie discale.

## Ce qui reste non mesuré

Onze poids lombaires ne citent aucune source : ce sont les priorités
structurelles héritées de l'arbre décisionnel historique (profil discal, profil
sténosant, entrée radiculaire, sièges de la douleur). Aucune publication ne
couvre ces profils composites. Ils sont nommés un par un dans
`tests/unit/reasoning-evidence.test.ts`, et ce test échoue si un nombre choisi à
la main apparaît ailleurs.

## Trois valeurs, pas deux

Un signal vaut `true`, `false`, ou reste **inconnu** — et inconnu n'est jamais
traité comme faux. C'est ce qui permet de distinguer « le patient n'a pas de
fièvre » de « je n'ai pas encore demandé », donc de proposer la bonne question
suivante au lieu de conclure trop vite.

L'évaluation suit la logique de Kleene : un `all` conclut « non » dès qu'un
membre est faux sans attendre les autres, un `atLeast` tranche dès que le seuil
est atteint ou devenu inatteignable. Une hypothèse s'écarte donc au premier
élément dirimant, sans interrogatoire complet.

## Ajouter une région

1. Ajouter les signaux manquants dans `signals.ts`. Formulation affirmative pour
   le `label`, interrogative pour la `question` — un signal qui porte une
   `question` sera proposé tout seul quand il manquera.
2. Créer `knowledge/<region>.ts` : les hypothèses avec leurs critères pondérés,
   et le catalogue d'actions (tests, questionnaires, examens, orientations).
3. Écrire les tests de non-régression sur les parcours discriminants.

## Poids ordinaux et rapports de vraisemblance

Un critère porte soit un **poids ordinal**, soit un **rapport de vraisemblance
sourcé** — jamais les deux, jamais aucun. Un test le vérifie.

Le rapport est la forme préférable partout où la littérature en publie un. Il
se multiplie au lieu de se comparer, ce qui rend les modifications locales :
ajouter une hypothèse ou un signe ne demande pas de réétalonner les autres.
C'est ce qui permettra de passer de dix-huit hypothèses à quatre-vingts sans
que chaque ajout devienne un chantier. Et un critère faux pèse aussi quand le
LR− est connu — un Lasègue négatif écarte réellement une hernie, là où un
positif ne dit presque rien.

**La source est obligatoire.** Un rapport sans référence est refusé par les
tests : c'est ce qui sépare un chiffre d'une intuition. Quand la valeur publiée
est une probabilité post-test plutôt qu'un rapport, la convertir exigerait une
prévalence supposée — donc inventée. On garde alors un poids ordinal et on cite
la probabilité dans le libellé.

Aucune probabilité post-test n'est calculée aujourd'hui : cela demanderait une
prévalence sourcée par hypothèse, que personne n'a publiée pour une patientèle
d'ostéopathie. Le modèle la porte (`prior`), le calcul attend les chiffres.

Sur les poids ordinaux : ce ne sont pas des probabilités. Ils reproduisent un ordre de
priorité clinique — une hypothèse spécifique passe devant un diagnostic
d'exclusion, un profil complet devant un profil partiel. `requires` sert aux
conditions dirimantes (fausse, l'hypothèse est écartée ; inconnue, elle reste en
attente et ne peut pas doubler une hypothèse retenue).

## Choisir le modèle d'extraction

Relever des faits dans une liste fermée n'est pas une tâche de raisonnement —
celui-ci est fait par le moteur déterministe. Un modèle léger suffit donc, et
ses erreurs sont visibles (chaque signal porte son verbatim) et rattrapables
(le praticien répond lui-même aux questions du copilote). Le défaut est
`claude-haiku-4-5` ; `EXTRACTION_MODEL` permet d'en essayer un autre.

L'évaluation tranche sur pièces, sur huit anamnèses dictées :

```bash
ANTHROPIC_API_KEY=sk-... npx vitest run --config vitest.eval.config.ts
EXTRACTION_MODEL=claude-opus-5 ANTHROPIC_API_KEY=sk-... npx vitest run --config vitest.eval.config.ts
```

Elle mesure le rappel (ce qui aurait dû être relevé et l'a été), les relevés à
tort, et surtout les inventions — un signal hors de tout ce qui était prévu
ferait raisonner le copilote sur du vide. Elle ne tourne pas dans la suite
habituelle : elle appelle l'API et coûte de l'argent.

## Ce qui n'est pas encore fait

- Les gates à seuil issus des arbres (`≥ 4 critères ASAS`, `≥ 2 critères
  facettaires`, `≥ 3 critères de Revel`) sont pour l'instant des signaux
  agrégés. Les critères individuels pourront être détaillés sans changer le
  modèle.
- Le moteur n'est branché sur aucune interface : les deux modales d'arbre
  fonctionnent comme avant, sur la logique de `legacy/`.
