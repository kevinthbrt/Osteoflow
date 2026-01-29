# ALIGNMENT — Phase 0 (analyse du repo avant migration desktop)

## ✅ Ce que **je fais maintenant**
- Analyse du repo pour inventorier les fonctionnalités réelles, les dépendances Supabase/Cloud et les risques techniques.
- Proposer une stratégie de migration réaliste vers Tauri + stockage local (SQLite), avec alternatives et impacts.

## 👤 Ce que **toi (Kevin) dois faire maintenant**
1) Confirmer que cette phase d’alignement te convient (aucun code fonctionnel n’est encore modifié).
2) Me fournir **si disponible** :
   - le détail des règles RLS actuelles si elles diffèrent des migrations,
   - les buckets Supabase utilisés (nom + politique d’accès),
   - les environnements (dev/prod) et l’usage réel des crons.

## ✅ Confirmations reçues (de ta part)
- Alignment validé (OK pour avancer).
- Emails : **local-only** via SMTP/IMAP (pas de Resend).
- Base locale : **préférence SQLCipher** si faisable ; sinon chiffrement applicatif.
- Front : choix **le plus stable** en desktop (migration Vite/React OK).
- Updates Phase 1 : **notification + lien GitHub Releases** (pas d’auto-update).

---

## 1) Fonctionnalités **réellement détectées** dans le repo (par écran/flux)
> Source = routes `src/app`, composants associés, API routes `src/app/api`, helpers `src/lib`, types `src/types`, migrations `supabase/migrations`.

### Auth & accès
- Connexion via Supabase Auth (email/mot de passe).【F:src/app/(auth)/login/page.tsx†L1-L118】
- Middleware Supabase pour rafraîchir la session et protéger les routes dashboard.【F:src/middleware.ts†L1-L34】【F:src/lib/supabase/middleware.ts†L1-L75】
- Callback OAuth/PKCE Supabase (auth/callback).【F:src/app/auth/callback/route.ts†L1-L29】

### Tableau de bord
- KPIs : total patients, consultations du jour, CA du mois, anniversaires, consultations récentes, messages non lus.【F:src/app/(dashboard)/dashboard/page.tsx†L1-L109】

### Patients
- Liste + recherche côté client (avec archivage).【F:src/app/(dashboard)/patients/page.tsx†L1-L143】
- Création, édition, suppression (RGPD), export JSON patient complet.【F:src/components/patients/patient-form.tsx†L1-L260】【F:src/app/(dashboard)/settings/page.tsx†L430-L618】
- Dossier patient : consultations liées + antécédents structurés (medical_history_entries).【F:src/app/(dashboard)/patients/[id]/page.tsx†L1-L77】【F:src/components/patients/medical-history-section.tsx†L1-L275】

### Consultations
- Liste + filtres, page détail, édition, création depuis patient.【F:src/app/(dashboard)/consultations/page.tsx†L1-L98】【F:src/app/(dashboard)/consultations/[id]/page.tsx†L1-L63】【F:src/app/(dashboard)/consultations/[id]/edit/page.tsx†L1-L81】【F:src/app/(dashboard)/patients/[id]/consultation/new/page.tsx†L1-L64】
- Création de facture + paiements, et planification automatique d’un follow-up J+7 via `scheduled_tasks`.【F:src/components/consultations/consultation-form.tsx†L1-L270】

### Facturation
- Liste factures + filtres et statuts (draft/issued/paid/cancelled).【F:src/app/(dashboard)/invoices/page.tsx†L1-L126】
- Détail facture + modification statut + paiements.【F:src/app/(dashboard)/invoices/[id]/page.tsx†L1-L181】
- Génération PDF (PDFKit) via API route /api/invoices/[id]/pdf.【F:src/app/api/invoices/[id]/pdf/route.ts†L1-L74】【F:src/lib/pdf/invoice-pdfkit.ts†L1-L125】

### Comptabilité
- Dashboard comptable + filtres période + export CSV anonymisé + envoi email au comptable (PDF).【F:src/app/(dashboard)/accounting/page.tsx†L1-L260】【F:src/app/api/accounting/send-report/route.ts†L1-L198】

### Messagerie
- Conversations (patient ou email externe), messages entrants/sortants, templates de réponses rapides.【F:src/app/(dashboard)/messages/page.tsx†L1-L311】【F:src/components/messages/quick-replies.tsx†L1-L138】【F:src/components/messages/new-conversation-modal.tsx†L1-L310】
- Notifications de messages non lus (polling + realtime Supabase).【F:src/components/layout/header.tsx†L1-L117】
- Réception emails via IMAP + création conversations/messages (API /api/emails/check-inbox).【F:src/app/api/emails/check-inbox/route.ts†L1-L258】
- Envoi email individuel (API /api/messages/send-email).【F:src/app/api/messages/send-email/route.ts†L1-L156】

### Emails automatiques
- Templates email (facture, suivi J+7).【F:src/lib/email/templates.ts†L1-L95】
- Envoi facture par email (API /api/emails/invoice).【F:src/app/api/emails/invoice/route.ts†L1-L121】
- Cron follow-up J+7 (API /api/emails/follow-up) + déclenchement manuel par consultation.【F:src/app/api/emails/follow-up/route.ts†L1-L320】

### Paramètres / RGPD / personnalisation
- Profil praticien (infos cabinet, couleur primaire, logo/tampon, numéro facture).【F:src/app/(dashboard)/settings/page.tsx†L1-L620】
- Email settings (SMTP/IMAP) + tests de connexion.【F:src/app/api/emails/settings/route.ts†L1-L229】
- Templates email personnalisés (CRUD).【F:src/app/(dashboard)/settings/page.tsx†L320-L367】
- Types de séance (session_types).【F:src/app/(dashboard)/settings/page.tsx†L190-L230】
- RGPD export/suppression patient.【F:src/app/(dashboard)/settings/page.tsx†L430-L618】

### Statistiques
- Statistiques patients/consultations/CA via RPC Supabase (fallback requêtes directes).【F:src/app/(dashboard)/statistics/page.tsx†L1-L222】

---

## 2) Dépendances **exactes** à Supabase / Cloud

### Auth & session
- Supabase Auth pour login + session cookies + middleware SSR.【F:src/app/(auth)/login/page.tsx†L1-L118】【F:src/lib/supabase/middleware.ts†L1-L75】

### Base de données (PostgreSQL + RLS)
- Tables principales : practitioners, patients, consultations, invoices, payments, scheduled_tasks, email_templates, messages, conversations, message_templates, medical_history_entries, email_settings, audit_logs, session_types, saved_reports.【F:supabase/migrations/001_initial_schema.sql†L1-L399】【F:supabase/migrations/002_messages_schema.sql†L1-L182】【F:supabase/migrations/003_medical_history_statistics.sql†L1-L221】【F:supabase/migrations/email_settings.sql†L1-L116】
- RLS / triggers / audit logs (server-side).【F:supabase/migrations/001_initial_schema.sql†L240-L399】

### Storage
- Upload stamp image (tampon) via Supabase Storage bucket `stamps` + URL publique stockée en DB.【F:src/app/(dashboard)/settings/page.tsx†L500-L552】

### RPC / fonctions SQL
- Stats via RPC (`get_patient_statistics`, `get_consultation_statistics`, `get_revenue_statistics`).【F:src/app/(dashboard)/statistics/page.tsx†L70-L120】【F:supabase/migrations/003_medical_history_statistics.sql†L86-L220】
- Appelle un RPC `increment_unread` **non défini** dans les migrations → incohérence probable à résoudre lors de la migration.【F:src/app/api/emails/check-inbox/route.ts†L231】

### Services email cloud
- Resend utilisé pour : suivi J+7 + facture + rapport comptable fallback SMTP.【F:src/app/api/emails/follow-up/route.ts†L1-L200】【F:src/app/api/emails/invoice/route.ts†L1-L120】【F:src/app/api/accounting/send-report/route.ts†L1-L198】

### Cron / Scheduler
- Cron Vercel recommandé pour `/api/emails/follow-up` (docs README).【F:README.md†L70-L93】
- Aucune orchestration locale persistante (à créer pour desktop).

### Contexte fourni par toi (prod)
- RLS réelles = export `pg_policies` (public + storage) considéré comme **source de vérité**.
- Bucket unique Supabase Storage : `stamps`, **public = true**.
- Cron actif en prod : cronjob.org toutes les minutes pour la réception emails (check-inbox).
- Follow-up J+7 doit être **catch-up** au démarrage si offline (J+8/J+9 ok) et email **générique** sans contenu clinique.

---

## 3) Contradictions / risques vs. ton prompt (et alternatives)

### A) Supabase Auth + DB Cloud vs Local-Only (contradiction majeure)
- **Problème** : le code dépend partout de Supabase (auth + DB).【F:src/lib/supabase/client.ts†L1-L20】【F:src/lib/supabase/server.ts†L1-L43】
- **Alternative 1** (recommandée) : profils locaux + SQLite chiffrée (1 DB par profil).
- **Impact** : refonte des appels `supabase` vers repositories SQLite + mécanisme d’auth local (password → Argon2id).

### B) API Routes Next.js vs App desktop offline
- **Problème** : endpoints API (emails, pdf, cron) supposent un backend serverless Vercel.【F:src/app/api/emails/follow-up/route.ts†L1-L320】
- **Alternative 1** : déplacer en **Tauri commands** + scheduler local.
- **Impact** : split client/desktop + adaptation sécurité (pas d’HTTP public).

### C) Resend (cloud) incompatible « données sensibles hors cloud »
- **Problème** : envoi emails cliniques via Resend cloud.【F:src/app/api/emails/follow-up/route.ts†L1-L200】
- **Alternative 1** : SMTP local (déjà partiellement présent via email_settings).【F:src/app/api/emails/settings/route.ts†L1-L229】
- **Impact** : demander au praticien ses identifiants SMTP/IMAP (Gmail/OVH/etc). Risque de quotas/2FA.

### D) Supabase Storage (logo/tampon) vs stockage local
- **Problème** : `stamps` bucket + URL publique. 【F:src/app/(dashboard)/settings/page.tsx†L500-L552】
- **Alternative** : stockage fichier local (app data) + référence locale dans SQLite.
- **Impact** : migration des fichiers existants + adaptation des templates PDF.

### H) Divergences RLS (prod vs migrations repo)
- **Constaté** : politiques RLS **session_types** présentes en prod, **absentes des migrations** du repo → à reconstituer lors de la migration (et lors de la future base locale). Politiques prod : `session_types_select_own`, `session_types_insert_own`, `session_types_update_own`, `session_types_delete_own`.【F:supabase/migrations/001_initial_schema.sql†L380-L517】
- **Constaté** : politiques `storage.objects` pour le bucket `stamps` **absentes des migrations** (stockage géré séparément). Politiques prod : `Authenticated users can view stamps`, `Practitioners can upload/update/delete their own stamp` (scope foldername = practitioner.id).【F:src/app/(dashboard)/settings/page.tsx†L500-L552】

### E) Realtime Supabase (notifications)
- **Problème** : header utilise `supabase.channel` pour realtime.【F:src/components/layout/header.tsx†L83-L108】
- **Alternative** : observer SQLite + event bus local (ou polling).
- **Impact** : logique de notification à réécrire.

### F) Next.js dans Tauri
- **Problème** : Next.js App Router + API routes reposent sur Node SSR.
- **Alternative 1** : migrer vers Vite + React + Tailwind (reprise UI/components).
- **Alternative 2** : exécuter Next.js via server local (Node sidecar) → plus lourd et fragile.
- **Impact** : effort de migration front/route important mais nécessaire pour un desktop propre.

### G) Build macOS (signature/notarization)
- **Problème** : distribution macOS nécessite Apple Developer Program + notarisation.
- **Alternative** : fournir builds non-signés (alertes macOS) — non recommandé en prod.
- **Impact** : coût annuel Apple + procédures CI spécifiques.

---

## 4) Décisions techniques proposées (avec alternatives)

### Desktop wrapper
- **Proposé** : Tauri (priorité absolue) + Rust backend.
- **Alternative** : Electron si Next.js doit rester sans migration front (coût mémoire + sécurité + bundle).

### Frontend
- **Proposé** : Vite + React + Tailwind + réutilisation des composants existants.
- **Alternative** : maintenir Next.js + serveur local (moins fiable, plus complexe à distribuer).

### Données locales
- **Proposé** : SQLite + SQLCipher si possible.
- **Alternative** : SQLite + chiffrement applicatif AES-GCM sur champs sensibles.

### Auth locale
- **Proposé** : profils locaux (1 DB par profil), mot de passe → Argon2id + auto-lock.
- **Alternative** : profil unique local sans password (moins sûr, déconseillé).

### Emails
- **Proposé** : SMTP/IMAP local (configurable), queue locale + retry/backoff.
- **Alternative** : service email cloud (Resend) mais **non conforme** au “local-only”.
- **Note métier** : contenu follow-up **strictement générique**, sans mention clinique.

### Mises à jour Phase 1
- **Proposé** : GitHub Releases + check version au démarrage + lien de téléchargement.
- **Alternative** : auto-update (phase 2), nécessitera signature + infra.

---

## 5) Checklist d’actions

### A) ✅ CE QUE **KEVIN DOIT FAIRE** (actions manuelles)
1) (À venir) créer un compte Apple Developer **si** tu veux une app macOS signée/notarisée.
2) Définir précisément le **nombre de profils locaux** attendus et le workflow d’activation souhaité (création/sélection au démarrage).

### B) ✅ CE QUE **L’IA VA FAIRE** (plan de migration)
1) Produire un **POC Tauri + SQLite** minimal avec CRUD patient.
2) Remplacer progressivement chaque module Supabase → SQLite (patients, consultations, factures, etc.).
3) Implémenter profils locaux + auth + auto-lock.
4) Implémenter scheduler local (emails + follow-ups) + queue.
5) Implémenter phase 1 updates + GitHub Actions + RELEASE.md.
6) Tenir `MIGRATION_STATUS.md` à jour à chaque étape.

---

## 6) Prochaine étape (immédiate)
- **Valider cet ALIGNMENT.md.**
- Une fois validé, je commence la migration incrémentale **sans casser les fonctionnalités existantes**.
