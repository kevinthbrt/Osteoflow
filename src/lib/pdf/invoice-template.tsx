import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
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

const primaryColor = '#10B981'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  practitionerSection: {
    width: '50%',
  },
  practitionerName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  practitionerSpecialty: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 9,
    color: '#6B7280',
    marginBottom: 2,
  },
  patientSection: {
    width: '45%',
    alignItems: 'flex-end',
  },
  patientBox: {
    backgroundColor: primaryColor,
    padding: 12,
    borderRadius: 4,
  },
  patientName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  patientEmail: {
    fontSize: 9,
    color: '#FFFFFF',
  },
  metaSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  metaBox: {
    backgroundColor: primaryColor,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 6,
    paddingBottom: 6,
    borderRadius: 4,
  },
  metaText: {
    fontSize: 9,
    color: '#FFFFFF',
  },
  invoiceTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  invoiceLabel: {
    fontSize: 14,
    color: '#1F2937',
    marginRight: 10,
  },
  invoiceNumberBox: {
    backgroundColor: primaryColor,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 6,
    paddingBottom: 6,
    borderRadius: 4,
  },
  invoiceNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 8,
    marginBottom: 8,
  },
  tableHeaderDesc: {
    width: '70%',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  tableHeaderAmount: {
    width: '30%',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#6B7280',
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row',
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableDesc: {
    width: '70%',
  },
  tableAmount: {
    width: '30%',
    alignItems: 'flex-end',
  },
  itemText: {
    fontSize: 11,
    color: '#1F2937',
  },
  amountBox: {
    backgroundColor: primaryColor,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 4,
    paddingBottom: 4,
    borderRadius: 4,
  },
  amountText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1F2937',
    marginRight: 15,
  },
  totalBox: {
    backgroundColor: primaryColor,
    paddingLeft: 15,
    paddingRight: 15,
    paddingTop: 8,
    paddingBottom: 8,
    borderRadius: 4,
  },
  totalText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  paymentSection: {
    marginBottom: 30,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 6,
  },
  paymentLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginRight: 10,
  },
  paymentValue: {
    fontSize: 10,
    color: '#1F2937',
    width: 100,
    textAlign: 'right',
  },
  paymentBadge: {
    backgroundColor: primaryColor,
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 3,
    paddingBottom: 3,
    borderRadius: 4,
  },
  paymentBadgeText: {
    fontSize: 9,
    color: '#FFFFFF',
  },
  stampSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    marginBottom: 30,
  },
  stampImage: {
    width: 150,
    height: 80,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 7,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 2,
  },
})

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

const toText = (value: unknown): string => String(value ?? '')

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

export function InvoicePDF({
  data,
}: {
  data: InvoicePDFData
}): ReactElement<DocumentProps> {
  const safeData: InvoicePDFData = {
    practitionerName: normalizeText(data.practitionerName),
    practitionerSpecialty: normalizeText(data.practitionerSpecialty),
    practitionerAddress: normalizeText(data.practitionerAddress),
    practitionerCityLine: normalizeText(data.practitionerCityLine),
    practitionerSiret: normalizeText(data.practitionerSiret),
    practitionerRpps: normalizeText(data.practitionerRpps),
    patientName: normalizeText(data.patientName),
    patientEmail: normalizeText(data.patientEmail),
    locationLine: normalizeText(data.locationLine),
    invoiceNumber: normalizeText(data.invoiceNumber),
    sessionTypeLabel: normalizeText(data.sessionTypeLabel),
    amount: normalizeText(data.amount),
    paymentMethod: normalizeText(data.paymentMethod),
    paymentType: normalizeText(data.paymentType),
    paymentDate: normalizeText(data.paymentDate),
    invoiceDate: normalizeText(data.invoiceDate),
    stampUrl: normalizeText(data.stampUrl),
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.practitionerSection}>
            <Text style={styles.practitionerName}>{toText(safeData.practitionerName)}</Text>
            {safeData.practitionerSpecialty ? (
              <Text style={styles.practitionerSpecialty}>{toText(safeData.practitionerSpecialty)}</Text>
            ) : null}
            {safeData.practitionerAddress ? (
              <Text style={styles.infoText}>{toText(safeData.practitionerAddress)}</Text>
            ) : null}
            {safeData.practitionerCityLine ? (
              <Text style={styles.infoText}>{toText(safeData.practitionerCityLine)}</Text>
            ) : null}
            {safeData.practitionerSiret ? (
              <Text style={styles.infoText}>{'N SIREN: ' + toText(safeData.practitionerSiret)}</Text>
            ) : null}
            {safeData.practitionerRpps ? (
              <Text style={styles.infoText}>{'N RPPS: ' + toText(safeData.practitionerRpps)}</Text>
            ) : null}
          </View>

          <View style={styles.patientSection}>
            <View style={styles.patientBox}>
              <Text style={styles.patientName}>{toText(safeData.patientName)}</Text>
              {safeData.patientEmail ? (
                <Text style={styles.patientEmail}>{toText(safeData.patientEmail)}</Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.metaSection}>
          <View style={styles.metaBox}>
            <Text style={styles.metaText}>{toText(safeData.locationLine)}</Text>
          </View>
        </View>

        <View style={styles.invoiceTitle}>
          <Text style={styles.invoiceLabel}>Recu d honoraires n</Text>
          <View style={styles.invoiceNumberBox}>
            <Text style={styles.invoiceNumberText}>{toText(safeData.invoiceNumber)}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderDesc}>DESCRIPTION</Text>
            <Text style={styles.tableHeaderAmount}>MONTANT</Text>
          </View>

          <View style={styles.tableRow}>
            <View style={styles.tableDesc}>
              <Text style={styles.itemText}>{'Type de séance - ' + toText(safeData.sessionTypeLabel)}</Text>
            </View>
            <View style={styles.tableAmount}>
              <View style={styles.amountBox}>
                <Text style={styles.amountText}>{toText(safeData.amount)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>Somme a regler</Text>
          <View style={styles.totalBox}>
            <Text style={styles.totalText}>{toText(safeData.amount)}</Text>
          </View>
        </View>

        <View style={styles.paymentSection}>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Reglement</Text>
            <View style={styles.paymentBadge}>
              <Text style={styles.paymentBadgeText}>{toText(safeData.paymentMethod)}</Text>
            </View>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Type de reglement</Text>
            <Text style={styles.paymentValue}>{toText(safeData.paymentType)}</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Date du reglement</Text>
            <Text style={styles.paymentValue}>{toText(safeData.paymentDate)}</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Date de facturation</Text>
            <Text style={styles.paymentValue}>{toText(safeData.invoiceDate)}</Text>
          </View>
        </View>

        {safeData.stampUrl ? (
          <View style={styles.stampSection}>
            <Image src={toText(safeData.stampUrl)} style={styles.stampImage} />
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.footerText}>TVA non applicable selon article 261, 4-1 du CGI</Text>
          <Text style={styles.footerText}>Absence d escompte pour paiement anticipe</Text>
          <Text style={styles.footerText}>En cas de retard, penalites suivant le taux minimum legal en vigueur</Text>
          <Text style={styles.footerText}>Indemnite forfaitaire pour frais de recouvrement: 40 euros</Text>
        </View>
      </Page>
    </Document>
  )
}
