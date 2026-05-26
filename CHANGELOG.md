# Changelog

## [1.3.0] - 2026-05-26

### Nouveautés
- **Détection IA de tous les antécédents** : la dictée de l'anamnèse détecte désormais les antécédents chirurgicaux, traumatiques, médicaux (incluant les traitements en cours) et familiaux, en plus des champs patient existants (métier, sport, médecin traitant, grossesse)
- **Interface de validation par champ** : chaque information détectée par l'IA s'affiche avec un bouton ✓ (accepter) et ✕ (ignorer) individuel, plus "Valider tout" / "Tout ignorer" quand plusieurs champs sont en attente
- **Injection complète** : le bouton "Injecter dans la consultation" applique désormais aussi les antécédents et champs patient détectés, pas seulement l'anamnèse structurée
- **Rafraîchissement en direct** : les antécédents acceptés s'affichent immédiatement dans la colonne gauche de la consultation sans recharger la page
- **Codes couleur sur les antécédents** : les cartes d'antécédents utilisent le même code couleur que les boutons de création (chirurgical, traumatique, médical, familial)
- **Limite d'enregistrement étendue** à 10 minutes (alerte à 9 min)
- **Module exercices** : ajout des champs cible nerveuse et progression/régression dans la prescription ; support email PDF et téléchargement direct
- **Vue PDF inline** dans le viewer (plus de téléchargement forcé)

### Corrections
- Antécédents détectés par l'IA correctement insérés dans `medical_history_entries` (et non dans les anciens champs texte)
- Rafraîchissement de la section antécédents sans remise à zéro de l'état local
- Erreurs d'insertion DB silencieuses remontées correctement en toast d'erreur
- Champ fréquence dans la prescription d'exercices : correction de l'erreur Select avec valeur vide
- Détection Electron différée au client pour éviter les erreurs d'hydratation SSR
- Nettoyage des anciens champs plats d'antécédents (`surgical_history`, `trauma_history`, etc.) au démarrage

### Technique
- Détection des champs patient routée via le proxy `osteoupgrade.vercel.app` (plus d'appel direct à l'API Anthropic)
- Séparation `fetchEntries()` (état local) / `refreshEntries()` (état local + cache serveur) dans le wrapper antécédents

---

## [1.2.3] - 2025

- Mac ARM64 : suppression du besoin du Terminal pour les mises à jour
- Correction de l'architecture dans le flux de mise à jour macOS

## [1.2.2] - 2025

- Correction dictée vocale : bitrate 32 kbps + protection contre erreur 413

## [1.2.1] - 2025

- Suppression onglet IA dans les paramètres
- Mise à jour CGU v1.2
