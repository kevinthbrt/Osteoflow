import { isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import type { Invoice, Patient, Practitioner, Consultation, Payment } from '@/types/database'

interface InvoicePDFProps {
  invoice: Invoice
  consultation: Consultation
  patient: Patient
  practitioner: Practitioner
  payments: Payment[]
}

export interface InvoicePDFData {
  practitionerName: string
  practitionerSpecialty: string
  practitionerAddress: string
  practitionerCityLine: string
  practitionerSiret: string
  practitionerRpps: string
  patientName: string
  patientEmail: string
  locationLine: string
  invoiceNumber: string
  sessionTypeLabel: string
  amount: string
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
  const practSpecialty = normalizeText(practitioner?.specialty)
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

  return {
    practitionerName: normalizeText(practitionerName),
    practitionerSpecialty: normalizeText(practSpecialty),
    practitionerAddress: normalizeText(practAddress),
    practitionerCityLine: normalizeText(practitionerCityLine),
    practitionerSiret: normalizeText(practSiret),
    practitionerRpps: normalizeText(practRpps),
    patientName: normalizeText(patientName),
    patientEmail: normalizeText(patientEmail),
    locationLine: normalizeText(locationLine),
    invoiceNumber: normalizeText(invoiceNumber),
    sessionTypeLabel: normalizeText(sessionTypeLabel),
    amount: normalizeText(formatAmountPDF(invoice?.amount)),
    paymentMethod: normalizeText(method),
    paymentType: 'Comptant',
    paymentDate: normalizeText(payment ? formatDatePDF(payment.payment_date) : formatDatePDF(invoiceDateStr)),
    invoiceDate: normalizeText(formatDatePDF(invoiceDateStr)),
    stampUrl: normalizeText(stampUrl),
  }
}
