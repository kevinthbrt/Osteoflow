import { z } from 'zod'

export const bodyViewSchema = z.enum(['front', 'back'])
export const markerShapeSchema = z.enum(['dot', 'cross', 'bolt', 'star', 'triangle'])
export const markerTypeSchema = z.enum([
  'Douleur',
  'Tension',
  'Restriction',
  'Trigger point',
  'Inflammation',
  'Paresthésie',
])

export const bodyMarkerSchema = z.object({
  id: z.string(),
  view: bodyViewSchema,
  cx: z.number(),
  cy: z.number(),
  label: z.string().max(60),
  eva: z.number().min(0).max(10),
  type: markerTypeSchema,
  shape: markerShapeSchema,
  note: z.string().max(2000).optional(),
})

export const bodyPathSchema = z.object({
  id: z.string(),
  view: bodyViewSchema,
  kind: z.enum(['free', 'trajectory']),
  points: z.array(z.object({ x: z.number(), y: z.number() })),
  color: z.string().optional(),
  label: z.string().max(60).optional(),
})

export const consultationAnnotationsSchema = z.object({
  version: z.literal(1),
  markers: z.array(bodyMarkerSchema),
  paths: z.array(bodyPathSchema),
})

export const noteEntrySchema = z.object({
  id: z.string(),
  text: z.string().max(4000),
  createdAt: z.string(),
  markerId: z.string().optional(),
  markerLabel: z.string().optional(),
  markerEva: z.number().optional(),
})

export const consultationNotesStructuredSchema = z.object({
  version: z.literal(1),
  anamnesis: z.array(noteEntrySchema),
  examination: z.array(noteEntrySchema),
  treatment: z.array(noteEntrySchema),
  advice: z.array(noteEntrySchema),
})

export const consultationSchema = z.object({
  patient_id: z.string().uuid('ID patient invalide'),
  date_time: z
    .string()
    .min(1, 'La date et l\'heure sont requises'),
  session_type_id: z
    .string()
    .uuid('Type de séance invalide')
    .optional()
    .nullable(),
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
  treatment: z
    .string()
    .max(10000, 'Le traitement ne peut pas dépasser 10000 caractères')
    .optional()
    .or(z.literal('')),
  advice: z
    .string()
    .max(10000, 'Les conseils ne peuvent pas dépasser 10000 caractères')
    .optional()
    .or(z.literal('')),
  annotations: consultationAnnotationsSchema.optional().nullable(),
  notes_structured: consultationNotesStructuredSchema.optional().nullable(),
  follow_up_7d: z.boolean().optional().default(false),
  send_post_session_advice: z.boolean().optional().default(false),
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
