import type { FinanceSettings, VatRegime } from './types'
import { DEFAULT_FINANCE_SETTINGS } from './types'

/**
 * Traduit le régime de TVA de la facturation vers celui du moteur de calcul.
 *
 * La source de vérité reste `practitioners.vat_regime`, qui pilote déjà les
 * mentions légales des factures : un praticien qui facture « TVA non
 * applicable, art. 261-4-1° » ne peut pas être simulé comme assujetti.
 */
export function toVatRegime(invoiceVatRegime: string | null | undefined): VatRegime {
  switch (invoiceVatRegime) {
    case 'vat_20':
      return 'assujetti'
    case 'franchise_293b':
      return 'franchise'
    default:
      // exempt_261 et les régimes québécois : aucune TVA collectée côté France.
      return 'exonere'
  }
}

export interface FinanceSettingsRow {
  regime?: string | null
  retirement_fund?: string | null
  versement_liberatoire?: number | boolean | null
  acre?: number | boolean | null
  marital_status?: string | null
  dependents?: number | null
  other_household_income?: number | null
  safety_margin_rate?: number | null
  target_monthly_draw?: number | null
}

function toBoolean(value: number | boolean | null | undefined): boolean {
  return value === true || value === 1
}

/** Reconstitue les paramètres du moteur depuis la base. */
export function toFinanceSettings(
  row: FinanceSettingsRow | null | undefined,
  invoiceVatRegime: string | null | undefined,
): FinanceSettings {
  const vatRegime = toVatRegime(invoiceVatRegime)

  if (!row) {
    return { ...DEFAULT_FINANCE_SETTINGS, vatRegime }
  }

  return {
    regime: row.regime === 'reel_bnc' ? 'reel_bnc' : 'micro_bnc',
    retirementFund: row.retirement_fund === 'cipav' ? 'cipav' : 'ssi',
    vatRegime,
    vatRate: DEFAULT_FINANCE_SETTINGS.vatRate,
    versementLiberatoire: toBoolean(row.versement_liberatoire),
    acre: toBoolean(row.acre),
    maritalStatus:
      row.marital_status === 'couple' || row.marital_status === 'single_parent'
        ? row.marital_status
        : 'single',
    dependents: Math.max(0, Math.round(row.dependents ?? 0)),
    otherHouseholdIncome: Math.max(0, row.other_household_income ?? 0),
    // Le taux est stocké en pourcentage, le moteur raisonne en fraction.
    safetyMarginRate: Math.min(1, Math.max(0, (row.safety_margin_rate ?? 5) / 100)),
    targetMonthlyDraw: row.target_monthly_draw ?? null,
  }
}
