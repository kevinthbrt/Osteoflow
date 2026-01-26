import { z } from 'zod'

export const consultationSchema = z.object({
  patient_id: z.string().uuid('ID patient invalide'),
  date_time: z
    .string()
    .min(1, 'La date et l\'heure sont requises'),
  reason: z
    .string()
    .min(1, 'Le motif de consultation est requis')
    .max(500, 'Le motif ne peut pas dépasser 500 caractères'),
  anamnesis: z
    .string()
    .max(10000, 'L\'anamnèse ne peut pas dépasser 10000 caractères')
    .optional()
    .or(z.literal('')),
  examination: z
    .string()
    .max(10000, 'L\'examen ne peut pas dépasser 10000 caractères')
    .optional()
    .or(z.literal('')),
  advice: z
    .string()
    .max(10000, 'Les conseils ne peuvent pas dépasser 10000 caractères')
    .optional()
    .or(z.literal('')),
  follow_up_7d: z.boolean().optional().default(false),
})

export type ConsultationFormData = z.infer<typeof consultationSchema>

// Schema for creating consultation with optional invoice
export const consultationWithInvoiceSchema = consultationSchema.extend({
  create_invoice: z.boolean().optional().default(true),
  invoice_amount: z.number().positive('Le montant doit être positif').optional(),
  payments: z.array(z.object({
    amount: z.number().positive('Le montant doit être positif'),
    method: z.enum(['card', 'cash', 'check', 'transfer', 'other']),
    notes: z.string().optional(),
  })).optional(),
})

export type ConsultationWithInvoiceFormData = z.infer<typeof consultationWithInvoiceSchema>
