import { isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import type { Invoice, Patient, Practitioner, Consultation, Payment } from '@/types/database'
import { getProfessionLabel, getRegistrationLines, type RegistrationLine } from '@/lib/practitioner/profession'

interface InvoicePDFProps {
  invoice: Invoice
  consultation: Consultation
  patient: Patient
  practitioner: Practitioner
  payments: Payment[]
}

export interface InvoicePDFData {
  practitionerName: string
  practitionerStatus: string
  practitionerSpecialty: string
  practitionerAddress: string
  practitionerCityLine: string
  practitionerSiret: string
  practitionerRpps: string
  practitionerRegistrations: RegistrationLine[]
  patientName: string
  patientEmail: string
  locationLine: string
  invoiceNumber: string
  sessionTypeLabel: string
  amount: string
  amountHT: string
  vatRate: number
  vatAmount: string
  vatMention: string
  paymentMethod: string
  paymentType: string
  paymentDate: string
  invoiceDate: string
  stampUrl: string
}

const paymentMethodLabels: Record<string, string> = {
  card: 'Carte bancaire',
  cash: 'Especes',
  check: 'Cheque',
  transfer: 'Virement',
  other: 'Autre',
}

function formatDatePDF(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return ''
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
    if (isNaN(d.getTime())) return ''
    const day = d.getDate().toString().padStart(2, '0')
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    const year = d.getFullYear()
    return day + '/' + month + '/' + year
  } catch {
    return ''
  }
}

function formatAmountPDF(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '0.00 EUR'
  const numericAmount = typeof amount === 'number' ? amount : Number(amount)
  if (Number.isNaN(numericAmount)) return '0.00 EUR'
  return numericAmount.toFixed(2) + ' EUR'
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean).join(' ')
  }
  if (isValidElement(value)) {
    const element = value as ReactElement<{ children?: ReactNode }>
    return normalizeText(element.props?.children)
  }
  if (typeof value === 'object' && typeof (value as { toString?: () => string }).toString === 'function') {
    const str = (value as { toString: () => string }).toString()
    return str === '[object Object]' ? '' : str
  }
  return ''
}

export function buildInvoicePDFData({
  invoice,
  consultation,
  patient,
  practitioner,
  payments,
}: InvoicePDFProps): InvoicePDFData {
  const payment = payments && payments.length > 0 ? payments[0] : null
  const invoiceDateStr = normalizeText(invoice?.issued_at) || new Date().toISOString()
  const location = normalizeText(practitioner?.city) || 'Paris'

  const practLastName = normalizeText(practitioner?.last_name).toUpperCase()
  const practFirstName = normalizeText(practitioner?.first_name)
  const patLastName = normalizeText(patient?.last_name).toUpperCase()
  const patFirstName = normalizeText(patient?.first_name)
  const sessionTypeLabel = normalizeText(
    (consultation as Consultation & { session_type?: { name?: string | null } })?.session_type?.name
  ) || 'Type de séance'
  const paymentMethod = payment ? normalizeText(payment.method) : ''
  const method = paymentMethodLabels[paymentMethod] || 'Comptant'
  const invoiceNumber = normalizeText(invoice?.invoice_number)
  const practStatus = normalizeText(practitioner?.status)
  const practProfession = (practitioner as Record<string, unknown>)?.profession as string | null | undefined
  const practSpecialty = normalizeText(getProfessionLabel(practProfession, practitioner?.specialty))
  const practRegistrations = getRegistrationLines({
    profession: practProfession,
    rpps: practitioner?.rpps,
    rpe: (practitioner as Record<string, unknown>)?.rpe as string | null | undefined,
    rne: (practitioner as Record<string, unknown>)?.rne as string | null | undefined,
  }).map((line) => ({ label: line.label, value: normalizeText(line.value) }))
  const practAddress = normalizeText(practitioner?.address)
  const practPostalCode = normalizeText(practitioner?.postal_code)
  const practCity = normalizeText(practitioner?.city)
  const practSiret = normalizeText(practitioner?.siret)
  const practRpps = normalizeText(practitioner?.rpps)
  const patientEmail = normalizeText(patient?.email)
  const stampUrl = normalizeText(practitioner?.stamp_url)
  const practitionerName = `${practLastName} ${practFirstName}`.trim()
  const patientName = `${patLastName} ${patFirstName}`.trim()
  const practitionerCityLine = `${practPostalCode} ${practCity}`.trim()
  const locationLine = `${location}, le ${formatDatePDF(invoiceDateStr)}`.trim()

  const vatRegime = normalizeText((practitioner as Record<string, unknown>)?.vat_regime) || 'exempt_261'
  const rawAmount = typeof invoice?.amount === 'number' ? invoice.amount : Number(invoice?.amount) || 0

  let vatRate = 0
  let vatMention = ''
  let amountHT = rawAmount
  let vatAmount = 0

  if (vatRegime === 'vat_20') {
    vatRate = 20
    amountHT = rawAmount / 1.2
    vatAmount = rawAmount - amountHT
    vatMention = ''
  } else if (vatRegime === 'franchise_293b') {
    vatMention = 'TVA non applicable, art. 293 B du CGI'
  } else {
    vatMention = 'TVA non applicable, art. 261-4-1° du CGI'
  }

  return {
    practitionerName: normalizeText(practitionerName),
    practitionerStatus: normalizeText(practStatus),
    practitionerSpecialty: normalizeText(practSpecialty),
    practitionerAddress: normalizeText(practAddress),
    practitionerCityLine: normalizeText(practitionerCityLine),
    practitionerSiret: normalizeText(practSiret),
    practitionerRpps: normalizeText(practRpps),
    practitionerRegistrations: practRegistrations,
    patientName: normalizeText(patientName),
    patientEmail: normalizeText(patientEmail),
    locationLine: normalizeText(locationLine),
    invoiceNumber: normalizeText(invoiceNumber),
    sessionTypeLabel: normalizeText(sessionTypeLabel),
    amount: normalizeText(formatAmountPDF(invoice?.amount)),
    amountHT: normalizeText(formatAmountPDF(amountHT)),
    vatRate,
    vatAmount: normalizeText(formatAmountPDF(vatAmount)),
    vatMention,
    paymentMethod: normalizeText(method),
    paymentType: 'Comptant',
    paymentDate: normalizeText(payment ? formatDatePDF(payment.payment_date) : formatDatePDF(invoiceDateStr)),
    invoiceDate: normalizeText(formatDatePDF(invoiceDateStr)),
    stampUrl: normalizeText(stampUrl),
  }
}
