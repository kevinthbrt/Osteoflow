import type { TaxYearConfig } from './tax-config'
import type { VatRegime, VatResult } from './types'

/**
 * TVA sur la période.
 *
 * Rappel du cadre : l'exonération de l'article 261-4-1° du CGI vise les soins
 * dispensés par les professions médicales et paramédicales réglementées. Les
 * ostéopathes titulaires du titre en bénéficient pour leurs actes à finalité
 * thérapeutique, sans condition de chiffre d'affaires. Les praticiens non
 * réglementés (étiopathes, naturopathes…) sont dans le champ de la TVA et n'y
 * échappent que par la franchise en base, tant qu'ils restent sous les seuils.
 *
 * @param revenue Recettes encaissées, TTC lorsque le praticien est assujetti.
 */
export function computeVat(
  config: TaxYearConfig,
  regime: VatRegime,
  revenue: number,
  deductibleVatOnExpenses: number,
  vatRate: number,
): VatResult {
  if (regime === 'assujetti') {
    // Les recettes saisies sont TTC : on isole la TVA collectée.
    const revenueExcludingVat = revenue / (1 + vatRate)
    const collected = revenue - revenueExcludingVat
    const balance = collected - deductibleVatOnExpenses

    return {
      regime,
      collected,
      deductible: deductibleVatOnExpenses,
      due: Math.max(0, balance),
      credit: Math.max(0, -balance),
      revenueExcludingVat,
      franchiseWarning: 'none',
    }
  }

  // Franchise en base et exonération : pas de TVA collectée, et la TVA payée
  // sur les charges n'est pas récupérable — elle reste un coût.
  return {
    regime,
    collected: 0,
    deductible: 0,
    due: 0,
    credit: 0,
    revenueExcludingVat: revenue,
    franchiseWarning:
      regime === 'franchise' ? franchiseWarning(config, revenue) : 'none',
  }
}

/**
 * Suivi des seuils de franchise en base. Le dépassement du seuil majoré rend la
 * TVA exigible dès le premier jour du mois de dépassement, d'où l'alerte.
 */
function franchiseWarning(
  config: TaxYearConfig,
  revenue: number,
): VatResult['franchiseWarning'] {
  const { franchiseThreshold, franchiseToleranceThreshold } = config.vat

  if (revenue > franchiseToleranceThreshold) return 'tolerance_exceeded'
  if (revenue > franchiseThreshold) return 'exceeded'
  if (revenue > franchiseThreshold * 0.9) return 'approaching'
  return 'none'
}
