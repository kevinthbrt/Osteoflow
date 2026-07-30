import { z } from 'zod'
import { EXPENSE_CATEGORIES } from '@/lib/finance/categories'
import { ASSET_CATEGORIES } from '@/lib/finance/depreciation'

const categoryKeys = EXPENSE_CATEGORIES.map((category) => category.key) as [
  string,
  ...string[],
]

const assetCategoryKeys = ASSET_CATEGORIES.map((category) => category.key) as [
  string,
  ...string[],
]

export const fixedAssetSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'Le libellé est requis')
    .max(200, 'Le libellé ne peut pas dépasser 200 caractères'),
  category: z.enum(assetCategoryKeys).default('autre_immo'),
  service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
  amount_ht: z
    .number()
    .positive('Le montant doit être positif')
    .max(10000000, 'Montant trop élevé'),
  vat_rate: z.number().min(0).max(1),
  duration_years: z
    .number()
    .int()
    .min(1, 'La durée doit être d’au moins 1 an')
    .max(50, 'La durée ne peut pas dépasser 50 ans'),
  notes: z.string().max(1000).nullable().optional(),
})

export type FixedAssetInput = z.infer<typeof fixedAssetSchema>

export const expenseSchema = z.object({
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
  label: z
    .string()
    .trim()
    .min(1, 'Le libellé est requis')
    .max(200, 'Le libellé ne peut pas dépasser 200 caractères'),
  category: z.enum(categoryKeys).default('autre'),
  amount_ht: z
    .number()
    .min(0, 'Le montant ne peut pas être négatif')
    .max(1000000, 'Montant trop élevé'),
  vat_rate: z.number().min(0).max(1, 'Le taux de TVA doit être une fraction (0,2 pour 20 %)'),
  deductible_share: z
    .number()
    .min(0, 'La quote-part ne peut pas être négative')
    .max(100, 'La quote-part ne peut pas dépasser 100 %')
    .default(100),
  recurrence: z.enum(['once', 'monthly', 'quarterly', 'yearly']).default('once'),
  payment_method: z.string().max(50).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
})

export type ExpenseInput = z.infer<typeof expenseSchema>

export const financeSettingsSchema = z.object({
  regime: z.enum(['micro_bnc', 'reel_bnc']).default('micro_bnc'),
  retirement_fund: z.enum(['ssi', 'cipav']).default('ssi'),
  versement_liberatoire: z.boolean().default(false),
  acre: z.boolean().default(false),
  marital_status: z.enum(['single', 'couple', 'single_parent']).default('single'),
  dependents: z.number().int().min(0).max(20).default(0),
  other_household_income: z.number().min(0).max(10000000).default(0),
  safety_margin_rate: z.number().min(0).max(50).default(5),
  target_monthly_draw: z.number().min(0).max(1000000).nullable().optional(),
  vehicle_mode: z.enum(['none', 'mileage', 'actual']).default('none'),
  vehicle_kind: z.enum(['car', 'motorcycle', 'moped']).default('car'),
  vehicle_horsepower: z.number().int().min(1).max(50).default(5),
  vehicle_annual_km: z.number().min(0).max(200000).default(0),
  vehicle_electric: z.boolean().default(false),
  optional_retirement: z.number().min(0).max(200000).default(0),
  optional_prevoyance: z.number().min(0).max(200000).default(0),
  input_mode: z.enum(['simple', 'real']).default('real'),
  simple_annual_expenses: z.number().min(0).max(5000000).default(0),
  simple_annual_expenses_vat: z.number().min(0).max(1000000).default(0),
  simple_flat_allowances: z.number().min(0).max(1000000).default(0),
  simple_depreciation: z.number().min(0).max(1000000).default(0),
  prior_year_social_settlement: z.number().min(0).max(1000000).default(0),
})

export type FinanceSettingsInput = z.infer<typeof financeSettingsSchema>
