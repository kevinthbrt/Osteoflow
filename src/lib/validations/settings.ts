import { z } from 'zod'

export const practitionerSettingsSchema = z.object({
  first_name: z
    .string()
    .min(1, 'Le prénom est requis')
    .max(100, 'Le prénom ne peut pas dépasser 100 caractères'),
  last_name: z
    .string()
    .min(1, 'Le nom est requis')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères'),
  email: z
    .string()
    .email('Format d\'email invalide'),
  phone: z
    .string()
    .max(20, 'Le téléphone ne peut pas dépasser 20 caractères')
    .optional()
    .or(z.literal('')),
  practice_name: z
    .string()
    .max(255, 'Le nom du cabinet ne peut pas dépasser 255 caractères')
    .optional()
    .or(z.literal('')),
  specialty: z
    .string()
    .max(100, 'La spécialité ne peut pas dépasser 100 caractères')
    .optional()
    .or(z.literal('')),
  address: z
    .string()
    .max(500, 'L\'adresse ne peut pas dépasser 500 caractères')
    .optional()
    .or(z.literal('')),
  city: z
    .string()
    .max(100, 'La ville ne peut pas dépasser 100 caractères')
    .optional()
    .or(z.literal('')),
  postal_code: z
    .string()
    .max(10, 'Le code postal ne peut pas dépasser 10 caractères')
    .optional()
    .or(z.literal('')),
  siret: z
    .string()
    .max(14, 'Le SIRET ne peut pas dépasser 14 caractères')
    .optional()
    .or(z.literal('')),
  rpps: z
    .string()
    .max(11, 'Le RPPS ne peut pas dépasser 11 caractères')
    .optional()
    .or(z.literal('')),
  default_rate: z
    .number()
    .positive('Le tarif doit être positif')
    .max(9999.99, 'Le tarif ne peut pas dépasser 9999.99€'),
  invoice_prefix: z
    .string()
    .min(1, 'Le préfixe est requis')
    .max(20, 'Le préfixe ne peut pas dépasser 20 caractères'),
  primary_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Format de couleur invalide (ex: #2563eb)'),
})

export type PractitionerSettingsFormData = z.infer<typeof practitionerSettingsSchema>

export const emailTemplateSchema = z.object({
  type: z.enum(['invoice', 'follow_up_7d']),
  subject: z
    .string()
    .min(1, 'L\'objet est requis')
    .max(255, 'L\'objet ne peut pas dépasser 255 caractères'),
  body: z
    .string()
    .min(1, 'Le contenu est requis')
    .max(10000, 'Le contenu ne peut pas dépasser 10000 caractères'),
})

export type EmailTemplateFormData = z.infer<typeof emailTemplateSchema>

export const emailTemplateTypeLabels: Record<string, string> = {
  invoice: 'Envoi de facture',
  follow_up_7d: 'Suivi J+7',
}

// Available template variables
export const emailTemplateVariables = {
  invoice: [
    { key: '{{patient_name}}', description: 'Nom complet du patient' },
    { key: '{{patient_first_name}}', description: 'Prénom du patient' },
    { key: '{{invoice_number}}', description: 'Numéro de facture' },
    { key: '{{invoice_amount}}', description: 'Montant de la facture' },
    { key: '{{invoice_date}}', description: 'Date de la facture' },
    { key: '{{practitioner_name}}', description: 'Nom du praticien' },
    { key: '{{practice_name}}', description: 'Nom du cabinet' },
  ],
  follow_up_7d: [
    { key: '{{patient_name}}', description: 'Nom complet du patient' },
    { key: '{{patient_first_name}}', description: 'Prénom du patient' },
    { key: '{{consultation_date}}', description: 'Date de la consultation' },
    { key: '{{consultation_reason}}', description: 'Motif de la consultation' },
    { key: '{{practitioner_name}}', description: 'Nom du praticien' },
    { key: '{{practice_name}}', description: 'Nom du cabinet' },
  ],
}

// Email connection settings schema (SMTP/IMAP)
export const emailSettingsSchema = z.object({
  // SMTP (sending)
  smtp_host: z
    .string()
    .min(1, 'Le serveur SMTP est requis'),
  smtp_port: z
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(587),
  smtp_secure: z
    .boolean()
    .default(false),
  smtp_user: z
    .string()
    .min(1, 'L\'identifiant SMTP est requis'),
  smtp_password: z
    .string()
    .min(1, 'Le mot de passe SMTP est requis'),

  // IMAP (receiving)
  imap_host: z
    .string()
    .min(1, 'Le serveur IMAP est requis'),
  imap_port: z
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(993),
  imap_secure: z
    .boolean()
    .default(true),
  imap_user: z
    .string()
    .min(1, 'L\'identifiant IMAP est requis'),
  imap_password: z
    .string()
    .min(1, 'Le mot de passe IMAP est requis'),

  // Identity
  from_name: z
    .string()
    .max(255)
    .optional()
    .or(z.literal('')),
  from_email: z
    .string()
    .email('Format d\'email invalide'),

  // Sync
  sync_enabled: z
    .boolean()
    .default(true),
})

export type EmailSettingsFormData = z.infer<typeof emailSettingsSchema>

// Preset configurations for common email providers
export const emailProviderPresets = {
  gmail: {
    label: 'Gmail',
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_secure: false,
    imap_host: 'imap.gmail.com',
    imap_port: 993,
    imap_secure: true,
    instructions: [
      '1. Allez sur myaccount.google.com',
      '2. Sécurité → Validation en 2 étapes (activez-la)',
      '3. Sécurité → Mots de passe des applications',
      '4. Créez un mot de passe pour "Mail"',
      '5. Copiez le mot de passe généré (16 caractères)',
    ],
    helpUrl: 'https://support.google.com/accounts/answer/185833',
  },
  outlook: {
    label: 'Outlook / Hotmail',
    smtp_host: 'smtp-mail.outlook.com',
    smtp_port: 587,
    smtp_secure: false,
    imap_host: 'outlook.office365.com',
    imap_port: 993,
    imap_secure: true,
    instructions: [
      '1. Allez sur account.microsoft.com',
      '2. Sécurité → Options de sécurité avancées',
      '3. Mots de passe d\'application → Créer',
      '4. Copiez le mot de passe généré',
    ],
    helpUrl: 'https://support.microsoft.com/fr-fr/account-billing/utiliser-des-mots-de-passe-d-application',
  },
  yahoo: {
    label: 'Yahoo Mail',
    smtp_host: 'smtp.mail.yahoo.com',
    smtp_port: 587,
    smtp_secure: false,
    imap_host: 'imap.mail.yahoo.com',
    imap_port: 993,
    imap_secure: true,
    instructions: [
      '1. Allez sur login.yahoo.com/account/security',
      '2. Activez la validation en 2 étapes',
      '3. Générez un mot de passe d\'application',
      '4. Copiez le mot de passe généré',
    ],
    helpUrl: 'https://help.yahoo.com/kb/generate-third-party-passwords-sln15241.html',
  },
  ovh: {
    label: 'OVH Mail',
    smtp_host: 'ssl0.ovh.net',
    smtp_port: 587,
    smtp_secure: false,
    imap_host: 'ssl0.ovh.net',
    imap_port: 993,
    imap_secure: true,
    instructions: [
      '1. Utilisez votre adresse email OVH complète',
      '2. Utilisez votre mot de passe email OVH',
      '3. Aucune configuration supplémentaire requise',
    ],
    helpUrl: 'https://docs.ovh.com/fr/emails/',
  },
  ionos: {
    label: 'IONOS (1&1)',
    smtp_host: 'smtp.ionos.fr',
    smtp_port: 587,
    smtp_secure: false,
    imap_host: 'imap.ionos.fr',
    imap_port: 993,
    imap_secure: true,
    instructions: [
      '1. Utilisez votre adresse email IONOS complète',
      '2. Utilisez votre mot de passe email IONOS',
    ],
    helpUrl: 'https://www.ionos.fr/assistance/email/',
  },
}
