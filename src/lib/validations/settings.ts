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
    .max(20, 'Le RPPS ne peut pas dépasser 20 caractères')
    .optional()
    .or(z.literal('')),
  specialty: z
    .string()
    .max(100, 'La spécialité ne peut pas dépasser 100 caractères')
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
  accountant_email: z
    .string()
    .email('Format d\'email invalide')
    .optional()
    .or(z.literal('')),
  stamp_url: z
    .string()
    .url('URL d\'image invalide')
    .optional()
    .or(z.literal('')),
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
