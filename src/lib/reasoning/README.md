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
| `bridge.ts` | Traduit un parcours d'arbre décisionnel en signaux. |
| `legacy/` | Logique des arbres historiques, extraite des composants. Sert de référence. |

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

Sur les poids : ce ne sont pas des probabilités. Ils reproduisent un ordre de
priorité clinique — une hypothèse spécifique passe devant un diagnostic
d'exclusion, un profil complet devant un profil partiel. `requires` sert aux
conditions dirimantes (fausse, l'hypothèse est écartée ; inconnue, elle reste en
attente et ne peut pas doubler une hypothèse retenue).

## Ce qui n'est pas encore fait

- Les gates à seuil issus des arbres (`≥ 4 critères ASAS`, `≥ 2 critères
  facettaires`, `≥ 3 critères de Revel`) sont pour l'instant des signaux
  agrégés. Les critères individuels pourront être détaillés sans changer le
  modèle.
- Le moteur n'est branché sur aucune interface : les deux modales d'arbre
  fonctionnent comme avant, sur la logique de `legacy/`.
