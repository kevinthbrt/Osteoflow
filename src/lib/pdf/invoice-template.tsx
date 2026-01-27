import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'
import type { Invoice, Patient, Practitioner, Consultation, Payment } from '@/types/database'

interface InvoicePDFProps {
  invoice: Invoice
  consultation: Consultation
  patient: Patient
  practitioner: Practitioner
  payments: Payment[]
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

function formatAmountPDF(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '0.00 EUR'
  return amount.toFixed(2) + ' EUR'
}

function safeString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return ''
}

export function InvoicePDF({
  invoice,
  consultation,
  patient,
  practitioner,
  payments,
}: InvoicePDFProps) {
  const payment = payments && payments.length > 0 ? payments[0] : null
  const invoiceDateStr = safeString(invoice?.issued_at) || new Date().toISOString()
  const location = safeString(practitioner?.city) || 'Paris'

  const practLastName = safeString(practitioner?.last_name).toUpperCase()
  const practFirstName = safeString(practitioner?.first_name)
  const patLastName = safeString(patient?.last_name).toUpperCase()
  const patFirstName = safeString(patient?.first_name)
  const reason = safeString(consultation?.reason) || 'Consultation'
  const paymentMethod = payment ? safeString(payment.method) : ''
  const method = paymentMethodLabels[paymentMethod] || 'Comptant'
  const invoiceNumber = safeString(invoice?.invoice_number)
  const practSpecialty = safeString(practitioner?.specialty)
  const practAddress = safeString(practitioner?.address)
  const practPostalCode = safeString(practitioner?.postal_code)
  const practCity = safeString(practitioner?.city)
  const practSiret = safeString(practitioner?.siret)
  const practRpps = safeString(practitioner?.rpps)
  const patientEmail = safeString(patient?.email)
  const stampUrl = safeString(practitioner?.stamp_url)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.practitionerSection}>
            <Text style={styles.practitionerName}>{practLastName + ' ' + practFirstName}</Text>
            {practSpecialty ? (
              <Text style={styles.practitionerSpecialty}>{practSpecialty}</Text>
            ) : null}
            {practAddress ? (
              <Text style={styles.infoText}>{practAddress}</Text>
            ) : null}
            {(practPostalCode || practCity) ? (
              <Text style={styles.infoText}>{practPostalCode + ' ' + practCity}</Text>
            ) : null}
            {practSiret ? (
              <Text style={styles.infoText}>{'N SIREN: ' + practSiret}</Text>
            ) : null}
            {practRpps ? (
              <Text style={styles.infoText}>{'N RPPS: ' + practRpps}</Text>
            ) : null}
          </View>

          <View style={styles.patientSection}>
            <View style={styles.patientBox}>
              <Text style={styles.patientName}>{patLastName + ' ' + patFirstName}</Text>
              {patientEmail ? (
                <Text style={styles.patientEmail}>{patientEmail}</Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.metaSection}>
          <View style={styles.metaBox}>
            <Text style={styles.metaText}>{location + ', le ' + formatDatePDF(invoiceDateStr)}</Text>
          </View>
        </View>

        <View style={styles.invoiceTitle}>
          <Text style={styles.invoiceLabel}>Recu d honoraires n</Text>
          <View style={styles.invoiceNumberBox}>
            <Text style={styles.invoiceNumberText}>{invoiceNumber}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderDesc}>DESCRIPTION</Text>
            <Text style={styles.tableHeaderAmount}>MONTANT</Text>
          </View>

          <View style={styles.tableRow}>
            <View style={styles.tableDesc}>
              <Text style={styles.itemText}>{'Seance du jour - ' + reason}</Text>
            </View>
            <View style={styles.tableAmount}>
              <View style={styles.amountBox}>
                <Text style={styles.amountText}>{formatAmountPDF(invoice?.amount)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>Somme a regler</Text>
          <View style={styles.totalBox}>
            <Text style={styles.totalText}>{formatAmountPDF(invoice?.amount)}</Text>
          </View>
        </View>

        <View style={styles.paymentSection}>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Reglement</Text>
            <View style={styles.paymentBadge}>
              <Text style={styles.paymentBadgeText}>{method}</Text>
            </View>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Type de reglement</Text>
            <Text style={styles.paymentValue}>Comptant</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Date du reglement</Text>
            <Text style={styles.paymentValue}>{payment ? formatDatePDF(payment.payment_date) : formatDatePDF(invoiceDateStr)}</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Date de facturation</Text>
            <Text style={styles.paymentValue}>{formatDatePDF(invoiceDateStr)}</Text>
          </View>
        </View>

        {stampUrl ? (
          <View style={styles.stampSection}>
            <Image src={stampUrl} style={styles.stampImage} />
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
