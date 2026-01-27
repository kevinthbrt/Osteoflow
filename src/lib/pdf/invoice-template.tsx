import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'
import { formatDate, formatCurrency } from '@/lib/utils'
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
    maxWidth: '45%',
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
  practitionerInfo: {
    fontSize: 9,
    color: '#6B7280',
    lineHeight: 1.5,
  },
  patientSection: {
    maxWidth: '45%',
    alignItems: 'flex-end',
  },
  patientBox: {
    backgroundColor: primaryColor,
    padding: 12,
    borderRadius: 4,
    minWidth: 180,
  },
  patientName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  patientAddress: {
    fontSize: 9,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  metaSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  metaBox: {
    backgroundColor: primaryColor,
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    gap: 10,
  },
  invoiceLabel: {
    fontSize: 14,
    color: '#1F2937',
  },
  invoiceNumber: {
    backgroundColor: primaryColor,
    paddingHorizontal: 12,
    paddingVertical: 6,
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
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  descriptionCol: {
    flex: 3,
  },
  amountCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  itemDescription: {
    fontSize: 11,
    color: '#1F2937',
  },
  itemAmount: {
    backgroundColor: primaryColor,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  itemAmountText: {
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
    gap: 15,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  totalAmount: {
    backgroundColor: primaryColor,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 4,
  },
  totalAmountText: {
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
    gap: 10,
  },
  paymentLabel: {
    fontSize: 10,
    color: '#6B7280',
  },
  paymentValue: {
    fontSize: 10,
    color: '#1F2937',
    minWidth: 100,
    textAlign: 'right',
  },
  paymentBadge: {
    backgroundColor: primaryColor,
    paddingHorizontal: 8,
    paddingVertical: 3,
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
    maxWidth: 150,
    maxHeight: 80,
    objectFit: 'contain',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
  },
  footerText: {
    fontSize: 7,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 1.6,
  },
  footerDivider: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
    marginTop: 10,
  },
})

const paymentMethodLabels: Record<string, string> = {
  card: 'Carte bancaire',
  cash: 'Especes',
  check: 'Cheque',
  transfer: 'Virement',
  other: 'Autre',
}

export function InvoicePDF({
  invoice,
  consultation,
  patient,
  practitioner,
  payments,
}: InvoicePDFProps) {
  const payment = payments[0]
  const invoiceDate = invoice.issued_at ? new Date(invoice.issued_at) : new Date()
  const location = practitioner.city || 'Paris'

  // Safe string helper
  const safeStr = (val: string | null | undefined): string => val || ''

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.practitionerSection}>
            <Text style={styles.practitionerName}>
              {practitioner.last_name?.toUpperCase() || ''} {practitioner.first_name || ''}
            </Text>
            {practitioner.specialty ? (
              <Text style={styles.practitionerSpecialty}>
                {practitioner.specialty}
              </Text>
            ) : null}
            <View style={styles.practitionerInfo}>
              {practitioner.address ? (
                <Text>{practitioner.address}</Text>
              ) : null}
              {(practitioner.postal_code || practitioner.city) ? (
                <Text>
                  {safeStr(practitioner.postal_code)} {safeStr(practitioner.city)}
                </Text>
              ) : null}
              {practitioner.siret ? (
                <Text>N SIREN: {practitioner.siret}</Text>
              ) : null}
              {practitioner.rpps ? (
                <Text>N RPPS: {practitioner.rpps}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.patientSection}>
            <View style={styles.patientBox}>
              <Text style={styles.patientName}>
                {patient.last_name?.toUpperCase() || ''} {patient.first_name || ''}
              </Text>
              <Text style={styles.patientAddress}>
                {safeStr(patient.email)}
              </Text>
            </View>
          </View>
        </View>

        {/* Date */}
        <View style={styles.metaSection}>
          <View style={styles.metaBox}>
            <Text style={styles.metaText}>
              {location}, le {formatDate(invoiceDate.toISOString())}
            </Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.invoiceTitle}>
          <Text style={styles.invoiceLabel}>Recu d honoraires n</Text>
          <View style={styles.invoiceNumber}>
            <Text style={styles.invoiceNumberText}>{invoice.invoice_number}</Text>
          </View>
        </View>

        {/* Items */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.descriptionCol]}>
              Description
            </Text>
            <View style={styles.amountCol}>
              <Text style={styles.tableHeaderCell}>Montant</Text>
            </View>
          </View>

          <View style={styles.tableRow}>
            <View style={styles.descriptionCol}>
              <Text style={styles.itemDescription}>
                Seance du jour - {consultation.reason || 'Consultation'}
              </Text>
            </View>
            <View style={styles.amountCol}>
              <View style={styles.itemAmount}>
                <Text style={styles.itemAmountText}>
                  {formatCurrency(invoice.amount)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Total */}
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>Somme a regler</Text>
          <View style={styles.totalAmount}>
            <Text style={styles.totalAmountText}>
              {formatCurrency(invoice.amount)}
            </Text>
          </View>
        </View>

        {/* Payment */}
        <View style={styles.paymentSection}>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Reglement</Text>
            <View style={styles.paymentBadge}>
              <Text style={styles.paymentBadgeText}>
                {payment ? paymentMethodLabels[payment.method] || payment.method : 'Comptant'}
              </Text>
            </View>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Type de reglement</Text>
            <Text style={styles.paymentValue}>Comptant</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Date du reglement</Text>
            <Text style={styles.paymentValue}>
              {payment ? formatDate(payment.payment_date) : formatDate(invoiceDate.toISOString())}
            </Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Date de facturation</Text>
            <Text style={styles.paymentValue}>
              {formatDate(invoiceDate.toISOString())}
            </Text>
          </View>
        </View>

        {/* Stamp */}
        {practitioner.stamp_url ? (
          <View style={styles.stampSection}>
            <Image src={practitioner.stamp_url} style={styles.stampImage} />
          </View>
        ) : null}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerDivider}>
            <Text style={styles.footerText}>
              TVA non applicable selon article 261, 4-1 du CGI
            </Text>
            <Text style={styles.footerText}>
              Absence d escompte pour paiement anticipe
            </Text>
            <Text style={styles.footerText}>
              En cas de retard, il sera applique des penalites suivant le taux minimum legal en vigueur
            </Text>
            <Text style={styles.footerText}>
              En outre, une indemnite forfaitaire pour frais de recouvrement de 40 euros sera due.
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
