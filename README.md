# Osteoflow

Application web de gestion de cabinet d'ostéopathie : patients, consultations, facturation, emails automatiques et comptabilité.

## Fonctionnalités

- **Gestion des patients** : CRUD complet, recherche instantanée, antécédents médicaux
- **Consultations** : Création avec anamnèse, examen, conseils, suivi J+7 automatique
- **Facturation** : Génération PDF, paiements multiples/fractionnés, statuts
- **Emails** : Templates personnalisables, envoi automatique de factures et suivis
- **Comptabilité** : Tableaux de bord, filtres, exports CSV/Excel
- **RGPD** : Export/suppression des données, journaux d'audit, RLS Supabase

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | Next.js 14+ (App Router), TypeScript, Tailwind CSS |
| UI | shadcn/ui (Radix), Lucide Icons |
| State | TanStack Query |
| Backend | Supabase (PostgreSQL, Auth, Storage) |
| Email | Resend |
| PDF | @react-pdf/renderer |
| Validation | Zod |
| Tests | Vitest + Playwright |
| Déploiement | Vercel |

## Installation

### Prérequis

- Node.js 18+
- Compte Supabase
- Compte Resend (pour les emails)

### 1. Cloner le projet

```bash
git clone https://github.com/votre-repo/osteoflow.git
cd osteoflow
npm install
```

### 2. Configuration Supabase

1. Créez un projet sur [Supabase](https://supabase.com)
2. Exécutez le fichier de migration SQL dans l'éditeur SQL de Supabase :
   - Ouvrez `supabase/migrations/001_initial_schema.sql`
   - Copiez et exécutez dans Supabase Dashboard > SQL Editor

### 3. Variables d'environnement

Créez un fichier `.env.local` :

```bash
cp .env.local.example .env.local
```

Remplissez les variables :

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-anon-key
SUPABASE_SERVICE_ROLE_KEY=votre-service-role-key

# Resend (Email)
RESEND_API_KEY=re_votre_api_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optionnel: Pour le cron des emails de suivi
CRON_SECRET=votre-secret-cron
```

### 4. Créer un utilisateur admin

Dans Supabase Dashboard > Authentication > Users, créez un utilisateur.

### 5. Lancer le développement

```bash
npm run dev
```

Accédez à [http://localhost:3000](http://localhost:3000)

## Déploiement sur Vercel

1. Connectez votre repo GitHub à Vercel
2. Configurez les variables d'environnement dans Vercel
3. Déployez

### Cron pour les emails de suivi J+7

Pour automatiser les emails de suivi, configurez un cron job qui appelle :

```
POST /api/emails/follow-up
Authorization: Bearer VOTRE_CRON_SECRET
```

Avec Vercel, utilisez [vercel.json](https://vercel.com/docs/cron-jobs) :

```json
{
  "crons": [
    {
      "path": "/api/emails/follow-up",
      "schedule": "0 9 * * *"
    }
  ]
}
```

## Structure du projet

```
osteoflow/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Routes publiques (login)
│   │   ├── (dashboard)/       # Routes protégées
│   │   │   ├── patients/
│   │   │   ├── consultations/
│   │   │   ├── invoices/
│   │   │   ├── accounting/
│   │   │   └── settings/
│   │   └── api/               # API Routes
│   ├── components/
│   │   ├── ui/                # Composants shadcn/ui
│   │   ├── layout/            # Header, Sidebar
│   │   ├── patients/          # Composants patients
│   │   ├── consultations/     # Composants consultations
│   │   └── invoices/          # Composants factures
│   ├── lib/
│   │   ├── supabase/          # Clients Supabase
│   │   ├── validations/       # Schémas Zod
│   │   ├── utils/             # Helpers
│   │   ├── pdf/               # Template PDF
│   │   └── email/             # Templates email
│   ├── hooks/                 # React hooks
│   ├── types/                 # Types TypeScript
│   └── styles/                # CSS global
├── supabase/
│   └── migrations/            # SQL migrations
├── tests/
│   ├── unit/                  # Tests unitaires
│   └── e2e/                   # Tests E2E
└── docs/                      # Documentation
```

## RGPD et Sécurité

### Où sont stockées les données ?

- **Base de données** : Supabase (PostgreSQL) avec chiffrement au repos
- **Fichiers** : Supabase Storage (optionnel pour les PDFs)
- **Sessions** : Cookies sécurisés via Supabase Auth

### Row Level Security (RLS)

Chaque praticien ne peut accéder qu'à ses propres données grâce aux politiques RLS de PostgreSQL. Toutes les requêtes sont automatiquement filtrées.

### Journal d'audit

Toutes les créations, modifications et suppressions sont tracées dans la table `audit_logs` avec :
- ID du praticien
- Table concernée
- Action (INSERT/UPDATE/DELETE)
- Données avant/après

### Export et suppression des données

Dans Paramètres > RGPD :
- **Export** : Télécharge un JSON complet des données du patient
- **Suppression** : Efface définitivement toutes les données (cascade)

### Chiffrement applicatif (optionnel)

Pour les champs cliniques sensibles (anamnèse, examen, conseils), un chiffrement AES-256-GCM peut être implémenté côté client.

**Compromis** :
- ✅ Protection même si la base est compromise
- ❌ Recherche full-text impossible sur les champs chiffrés
- ❌ Perte de données si perte de clé

**Choix actuel** : Non implémenté par défaut (complexité vs. bénéfice pour un cabinet individuel). Le chiffrement au repos de Supabase est suffisant pour la plupart des cas.

## Checklist Production

### Sécurité

- [ ] Variables d'environnement sécurisées (pas de secrets dans le code)
- [ ] RLS activé sur toutes les tables
- [ ] Rate limiting sur l'API Supabase
- [ ] HTTPS obligatoire
- [ ] Cookies sécurisés (HttpOnly, Secure, SameSite)
- [ ] Validation Zod sur tous les inputs

### Backups

- [ ] Activer les backups automatiques Supabase (Pro plan)
- [ ] Ou configurer pg_dump manuellement
- [ ] Tester la restauration régulièrement

### Monitoring

- [ ] Activer les logs Vercel
- [ ] Configurer les alertes Supabase
- [ ] Monitorer les erreurs (Sentry optionnel)

### Performance

- [ ] Activer le cache Next.js
- [ ] Optimiser les images
- [ ] Lazy loading des composants lourds (PDF)

### Conformité

- [ ] Page de politique de confidentialité
- [ ] Page de CGU
- [ ] Consentement cookies (si analytics)
- [ ] Export RGPD fonctionnel
- [ ] Suppression RGPD fonctionnelle

## Tests

```bash
# Tests unitaires
npm run test

# Tests E2E (nécessite une instance Supabase de test)
npm run test:e2e
```

## Scripts

```bash
npm run dev      # Développement
npm run build    # Build production
npm run start    # Production
npm run lint     # ESLint
npm run test     # Tests unitaires
npm run test:e2e # Tests E2E
```

## Personnalisation

### Templates email

Les templates sont personnalisables dans Paramètres > Emails. Variables disponibles :

**Facture** :
- `{{patient_name}}`, `{{patient_first_name}}`
- `{{invoice_number}}`, `{{invoice_amount}}`, `{{invoice_date}}`
- `{{practitioner_name}}`, `{{practice_name}}`

**Suivi J+7** :
- `{{patient_name}}`, `{{patient_first_name}}`
- `{{consultation_date}}`, `{{consultation_reason}}`
- `{{practitioner_name}}`, `{{practice_name}}`

### Template PDF

Le template PDF est dans `src/lib/pdf/invoice-template.tsx`. Utilisez `@react-pdf/renderer` pour personnaliser.

### Couleurs

Modifiez la couleur principale dans Paramètres > Facturation ou dans `src/styles/globals.css`.

## Choix techniques

### Pourquoi Next.js App Router ?

- SSR pour le SEO et les performances
- Server Components pour réduire le JS côté client
- API Routes intégrées
- Middleware pour l'auth

### Pourquoi Supabase ?

- PostgreSQL complet avec RLS
- Auth intégrée (sessions sécurisées)
- Storage pour les fichiers
- Temps réel optionnel
- Hébergement EU possible

### Pourquoi pas de stockage PDF ?

Les PDFs sont générés à la volée pour :
- Économiser le stockage
- Toujours avoir la version à jour
- Simplifier la suppression RGPD

Si vous préférez stocker les PDFs, utilisez Supabase Storage.

## Support

Pour signaler un bug ou demander une fonctionnalité, ouvrez une issue sur GitHub.

## Licence

MIT
