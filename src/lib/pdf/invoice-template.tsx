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

// Palette de couleurs moderne et professionnelle
const colors = {
  primary: '#0F766E', // Teal profond
  primaryLight: '#14B8A6', // Teal clair
  primaryBg: '#F0FDFA', // Fond teal très léger
  dark: '#0F172A', // Slate 900
  text: '#334155', // Slate 700
  textLight: '#64748B', // Slate 500
  textMuted: '#94A3B8', // Slate 400
  border: '#E2E8F0', // Slate 200
  borderLight: '#F1F5F9', // Slate 100
  white: '#FFFFFF',
  success: '#059669', // Emerald 600
}

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: colors.white,
  },
  // En-tête avec bande décorative
  headerBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: colors.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
    marginTop: 10,
  },
  // Section praticien
  practitionerSection: {
    width: '55%',
  },
  practitionerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.dark,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  practitionerSpecialty: {
    fontSize: 11,
    color: colors.primary,
    marginBottom: 12,
    fontWeight: 'bold',
  },
  practitionerInfo: {
    marginTop: 8,
  },
  infoText: {
    fontSize: 9,
    color: colors.textLight,
    marginBottom: 3,
    lineHeight: 1.4,
  },
  infoLabel: {
    fontSize: 8,
    color: colors.textMuted,
    marginBottom: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Section titre facture
  invoiceTitleSection: {
    width: '40%',
    alignItems: 'flex-end',
  },
  invoiceTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 8,
    letterSpacing: 1,
  },
  invoiceNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  invoiceNumberLabel: {
    fontSize: 9,
    color: colors.textMuted,
    marginRight: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  invoiceNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.dark,
  },
  invoiceDate: {
    fontSize: 10,
    color: colors.textLight,
    marginTop: 6,
  },
  // Section patient - style carte moderne
  patientSection: {
    backgroundColor: colors.primaryBg,
    borderRadius: 8,
    padding: 20,
    marginBottom: 30,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  patientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  patientLabel: {
    fontSize: 8,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
    fontWeight: 'bold',
  },
  patientName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.dark,
    marginBottom: 4,
  },
  patientEmail: {
    fontSize: 10,
    color: colors.textLight,
  },
  locationBadge: {
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  locationText: {
    fontSize: 9,
    color: colors.text,
  },
  // Table moderne
  table: {
    marginBottom: 24,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.dark,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginBottom: 2,
  },
  tableHeaderDesc: {
    width: '60%',
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableHeaderQty: {
    width: '15%',
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  tableHeaderAmount: {
    width: '25%',
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.white,
  },
  tableDesc: {
    width: '60%',
  },
  tableQty: {
    width: '15%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableAmount: {
    width: '25%',
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  itemTitle: {
    fontSize: 11,
    color: colors.dark,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  itemSubtitle: {
    fontSize: 9,
    color: colors.textLight,
  },
  qtyText: {
    fontSize: 10,
    color: colors.text,
  },
  amountText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.dark,
  },
  // Section totaux moderne
  totalsSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 30,
  },
  totalsBox: {
    width: 220,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  totalLabel: {
    fontSize: 10,
    color: colors.textLight,
  },
  totalValue: {
    fontSize: 10,
    color: colors.text,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.primary,
    borderRadius: 6,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.white,
  },
  grandTotalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.white,
  },
  // Section paiement moderne
  paymentSection: {
    backgroundColor: colors.borderLight,
    borderRadius: 8,
    padding: 20,
    marginBottom: 30,
  },
  paymentTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.dark,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  paymentItem: {
    width: '50%',
    marginBottom: 10,
  },
  paymentLabel: {
    fontSize: 8,
    color: colors.textMuted,
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  paymentValue: {
    fontSize: 10,
    color: colors.dark,
    fontWeight: 'bold',
  },
  paymentBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  paymentBadgeText: {
    fontSize: 9,
    color: colors.white,
    fontWeight: 'bold',
  },
  // Section cachet/signature
  stampSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    marginBottom: 40,
  },
  stampContainer: {
    alignItems: 'center',
  },
  stampLabel: {
    fontSize: 8,
    color: colors.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stampImage: {
    width: 140,
    height: 70,
  },
  // Footer moderne
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
  },
  footerDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  footerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerLeft: {
    width: '70%',
  },
  footerRight: {
    width: '25%',
    alignItems: 'flex-end',
  },
  footerText: {
    fontSize: 7,
    color: colors.textMuted,
    marginBottom: 2,
    lineHeight: 1.4,
  },
  footerBrand: {
    fontSize: 8,
    color: colors.primary,
    fontWeight: 'bold',
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
        {/* Bande decorative en haut */}
        <View style={styles.headerBand} />

        {/* En-tete: Praticien + Titre facture */}
        <View style={styles.header}>
          <View style={styles.practitionerSection}>
            <Text style={styles.practitionerName}>{toText(safeData.practitionerName)}</Text>
            {safeData.practitionerSpecialty ? (
              <Text style={styles.practitionerSpecialty}>{toText(safeData.practitionerSpecialty)}</Text>
            ) : null}
            <View style={styles.practitionerInfo}>
              {safeData.practitionerAddress ? (
                <Text style={styles.infoText}>{toText(safeData.practitionerAddress)}</Text>
              ) : null}
              {safeData.practitionerCityLine ? (
                <Text style={styles.infoText}>{toText(safeData.practitionerCityLine)}</Text>
              ) : null}
              {safeData.practitionerSiret ? (
                <>
                  <Text style={styles.infoLabel}>SIREN</Text>
                  <Text style={styles.infoText}>{toText(safeData.practitionerSiret)}</Text>
                </>
              ) : null}
              {safeData.practitionerRpps ? (
                <>
                  <Text style={styles.infoLabel}>RPPS</Text>
                  <Text style={styles.infoText}>{toText(safeData.practitionerRpps)}</Text>
                </>
              ) : null}
            </View>
          </View>

          <View style={styles.invoiceTitleSection}>
            <Text style={styles.invoiceTitle}>RECU</Text>
            <View style={styles.invoiceNumberContainer}>
              <Text style={styles.invoiceNumberLabel}>N</Text>
              <Text style={styles.invoiceNumber}>{toText(safeData.invoiceNumber)}</Text>
            </View>
            <Text style={styles.invoiceDate}>{toText(safeData.locationLine)}</Text>
          </View>
        </View>

        {/* Section Patient */}
        <View style={styles.patientSection}>
          <View style={styles.patientHeader}>
            <View>
              <Text style={styles.patientLabel}>Adresse au patient</Text>
              <Text style={styles.patientName}>{toText(safeData.patientName)}</Text>
              {safeData.patientEmail ? (
                <Text style={styles.patientEmail}>{toText(safeData.patientEmail)}</Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Table des prestations */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderDesc}>Description</Text>
            <Text style={styles.tableHeaderQty}>Qte</Text>
            <Text style={styles.tableHeaderAmount}>Montant</Text>
          </View>

          <View style={styles.tableRow}>
            <View style={styles.tableDesc}>
              <Text style={styles.itemTitle}>{toText(safeData.sessionTypeLabel)}</Text>
              <Text style={styles.itemSubtitle}>Consultation osteopathique</Text>
            </View>
            <View style={styles.tableQty}>
              <Text style={styles.qtyText}>1</Text>
            </View>
            <View style={styles.tableAmount}>
              <Text style={styles.amountText}>{toText(safeData.amount)}</Text>
            </View>
          </View>
        </View>

        {/* Section Totaux */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Sous-total HT</Text>
              <Text style={styles.totalValue}>{toText(safeData.amount)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TVA (0%)</Text>
              <Text style={styles.totalValue}>0.00 EUR</Text>
            </View>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total TTC</Text>
              <Text style={styles.grandTotalValue}>{toText(safeData.amount)}</Text>
            </View>
          </View>
        </View>

        {/* Section Paiement */}
        <View style={styles.paymentSection}>
          <Text style={styles.paymentTitle}>Informations de paiement</Text>
          <View style={styles.paymentGrid}>
            <View style={styles.paymentItem}>
              <Text style={styles.paymentLabel}>Mode de reglement</Text>
              <View style={styles.paymentBadge}>
                <Text style={styles.paymentBadgeText}>{toText(safeData.paymentMethod)}</Text>
              </View>
            </View>
            <View style={styles.paymentItem}>
              <Text style={styles.paymentLabel}>Type</Text>
              <Text style={styles.paymentValue}>{toText(safeData.paymentType)}</Text>
            </View>
            <View style={styles.paymentItem}>
              <Text style={styles.paymentLabel}>Date du reglement</Text>
              <Text style={styles.paymentValue}>{toText(safeData.paymentDate)}</Text>
            </View>
            <View style={styles.paymentItem}>
              <Text style={styles.paymentLabel}>Date de facturation</Text>
              <Text style={styles.paymentValue}>{toText(safeData.invoiceDate)}</Text>
            </View>
          </View>
        </View>

        {/* Cachet / Signature */}
        {safeData.stampUrl ? (
          <View style={styles.stampSection}>
            <View style={styles.stampContainer}>
              <Text style={styles.stampLabel}>Cachet et signature</Text>
              <Image src={toText(safeData.stampUrl)} style={styles.stampImage} />
            </View>
          </View>
        ) : null}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerDivider} />
          <View style={styles.footerContent}>
            <View style={styles.footerLeft}>
              <Text style={styles.footerText}>TVA non applicable selon article 261, 4-1 du CGI</Text>
              <Text style={styles.footerText}>Absence d escompte pour paiement anticipe - En cas de retard, penalites suivant le taux minimum legal en vigueur</Text>
              <Text style={styles.footerText}>Indemnite forfaitaire pour frais de recouvrement: 40 euros</Text>
            </View>
            <View style={styles.footerRight}>
              <Text style={styles.footerBrand}>Osteoflow</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}
