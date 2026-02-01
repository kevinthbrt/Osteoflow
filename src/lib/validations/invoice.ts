import { z } from 'zod'

export const invoiceSchema = z.object({
  consultation_id: z.string().uuid('ID consultation invalide'),
  amount: z.number().positive('Le montant doit être positif'),
  notes: z
    .string()
    .max(1000, 'Les notes ne peuvent pas dépasser 1000 caractères')
    .optional()
    .or(z.literal('')),
})

export type InvoiceFormData = z.infer<typeof invoiceSchema>

export const invoiceStatusSchema = z.object({
  status: z.enum(['draft', 'issued', 'paid', 'cancelled']),
})

export type InvoiceStatusUpdate = z.infer<typeof invoiceStatusSchema>

export const paymentSchema = z.object({
  invoice_id: z.string().uuid('ID facture invalide'),
  amount: z.number().positive('Le montant doit être positif'),
  method: z.enum(['card', 'cash', 'check', 'transfer', 'other'], {
    required_error: 'Le mode de paiement est requis',
  }),
  payment_date: z.string().optional(),
  check_number: z
    .string()
    .max(50, 'Le numéro de chèque ne peut pas dépasser 50 caractères')
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .max(500, 'Les notes ne peuvent pas dépasser 500 caractères')
    .optional()
    .or(z.literal('')),
})

export type PaymentFormData = z.infer<typeof paymentSchema>

export const paymentMethodLabels: Record<string, string> = {
  card: 'Carte bancaire',
  cash: 'Espèces',
  check: 'Chèque',
  transfer: 'Virement',
  other: 'Autre',
}

export const invoiceStatusLabels: Record<string, string> = {
  draft: 'Brouillon',
  issued: 'Émise',
  paid: 'Payée',
  cancelled: 'Annulée',
}
