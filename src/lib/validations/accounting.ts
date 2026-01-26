import { z } from 'zod'

export const accountingFiltersSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  period: z.enum(['day', 'week', 'month', 'custom']).optional(),
  paymentMethod: z.enum(['card', 'cash', 'check', 'transfer', 'other', 'all']).optional(),
  patientId: z.string().uuid().optional().or(z.literal('')),
})

export type AccountingFilters = z.infer<typeof accountingFiltersSchema>

export const savedReportSchema = z.object({
  name: z
    .string()
    .min(1, 'Le nom est requis')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères'),
  filters: accountingFiltersSchema,
})

export type SavedReportFormData = z.infer<typeof savedReportSchema>

// Export format
export const exportFormatSchema = z.enum(['csv', 'xlsx'])
export type ExportFormat = z.infer<typeof exportFormatSchema>

// Accounting summary types
export interface AccountingSummary {
  totalRevenue: number
  totalConsultations: number
  averageAmount: number
  revenueByMethod: Record<string, number>
  consultationsByDay: { date: string; count: number; revenue: number }[]
}
