import { z } from 'zod'

// French phone validation regex
const frenchPhoneRegex = /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/

export const patientSchema = z.object({
  gender: z.enum(['M', 'F'], {
    required_error: 'Le sexe est requis',
  }),
  first_name: z
    .string()
    .min(1, 'Le prénom est requis')
    .max(100, 'Le prénom ne peut pas dépasser 100 caractères'),
  last_name: z
    .string()
    .min(1, 'Le nom est requis')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères'),
  birth_date: z
    .string()
    .min(1, 'La date de naissance est requise')
    .refine((date) => {
      const birthDate = new Date(date)
      const today = new Date()
      return birthDate <= today
    }, 'La date de naissance ne peut pas être dans le futur')
    .refine((date) => {
      const birthDate = new Date(date)
      const minDate = new Date('1900-01-01')
      return birthDate >= minDate
    }, 'La date de naissance semble incorrecte'),
  phone: z
    .string()
    .min(1, 'Le téléphone est requis')
    .regex(frenchPhoneRegex, 'Format de téléphone français invalide (ex: 06 12 34 56 78)'),
  email: z
    .string()
    .email('Format d\'email invalide')
    .optional()
    .or(z.literal('')),
  profession: z
    .string()
    .max(100, 'La profession ne peut pas dépasser 100 caractères')
    .optional()
    .or(z.literal('')),
  sport_activity: z
    .string()
    .max(255, 'L\'activité sportive ne peut pas dépasser 255 caractères')
    .optional()
    .or(z.literal('')),
  primary_physician: z
    .string()
    .max(255, 'Le médecin traitant ne peut pas dépasser 255 caractères')
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .max(5000, 'Les notes ne peuvent pas dépasser 5000 caractères')
    .optional()
    .or(z.literal('')),
})

export type PatientFormData = z.infer<typeof patientSchema>

// Schema for search/filter
export const patientSearchSchema = z.object({
  query: z.string().optional(),
  includeArchived: z.boolean().optional().default(false),
})

export type PatientSearchParams = z.infer<typeof patientSearchSchema>
