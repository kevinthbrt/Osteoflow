# MIGRATION_STATUS

## Phase 0 → Phase 1 (POC desktop)

| Fonctionnalité | Avant (Supabase/Web) | Après (Desktop local) | Statut | Tests manuels |
| --- | --- | --- | --- | --- |
| Profils locaux (sélection + création) | Supabase Auth | Profils locaux + base SQLite chiffrée | En cours (POC) | Créer un profil, ouvrir un profil |
| Patients (CRUD minimal) | Supabase table `patients` | SQLite (SQLCipher) table `patients` | En cours (POC) | Ajouter, lister, supprimer un patient |

## Notes
- Ce fichier sera mis à jour à chaque module migré.
