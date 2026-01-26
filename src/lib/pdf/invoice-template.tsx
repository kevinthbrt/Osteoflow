import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Invoice, Patient, Practitioner, Consultation, Payment } from '@/types/database'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  practitionerInfo: {
    maxWidth: '50%',
  },
  practitionerName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  practitionerAddress: {
    color: '#666',
    lineHeight: 1.4,
  },
  invoiceTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563eb',
    textAlign: 'right',
  },
  invoiceNumber: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
  },
  invoiceDate: {
    fontSize: 10,
    color: '#666',
    textAlign: 'right',
    marginTop: 2,
  },
  clientSection: {
    marginBottom: 30,
    padding: 15,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 10,
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clientName: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  clientInfo: {
    marginTop: 4,
    color: '#666',
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 8,
    marginBottom: 8,
  },
  tableHeaderCell: {
    fontWeight: 'bold',
    color: '#475569',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  descriptionCol: {
    flex: 3,
  },
  amountCol: {
    flex: 1,
    textAlign: 'right',
  },
  description: {
    fontWeight: 'bold',
  },
  descriptionDetail: {
    color: '#666',
    marginTop: 2,
    fontSize: 9,
  },
  totalRow: {
    flexDirection: 'row',
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#e2e8f0',
  },
  totalLabel: {
    flex: 3,
    fontWeight: 'bold',
    fontSize: 12,
  },
  totalAmount: {
    flex: 1,
    textAlign: 'right',
    fontWeight: 'bold',
    fontSize: 14,
    color: '#2563eb',
  },
  paymentsSection: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#f0fdf4',
    borderRadius: 4,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  paymentMethod: {
    color: '#166534',
  },
  paymentAmount: {
    fontWeight: 'bold',
    color: '#166534',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
  },
  note: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#fffbeb',
    borderRadius: 4,
    fontSize: 9,
    color: '#92400e',
  },
})

const paymentMethodLabels: Record<string, string> = {
  card: 'Carte bancaire',
  cash: 'Espèces',
  check: 'Chèque',
  transfer: 'Virement',
  other: 'Autre',
}

interface InvoicePDFProps {
  invoice: Invoice
  consultation: Consultation
  patient: Patient
  practitioner: Practitioner
  payments: Payment[]
}

export function InvoicePDF({
  invoice,
  consultation,
  patient,
  practitioner,
  payments,
}: InvoicePDFProps) {
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.practitionerInfo}>
            <Text style={styles.practitionerName}>
              {practitioner.practice_name ||
                `${practitioner.first_name} ${practitioner.last_name}`}
            </Text>
            <View style={styles.practitionerAddress}>
              {practitioner.address && <Text>{practitioner.address}</Text>}
              {practitioner.city && practitioner.postal_code && (
                <Text>
                  {practitioner.postal_code} {practitioner.city}
                </Text>
              )}
              {practitioner.phone && <Text>Tél: {practitioner.phone}</Text>}
              {practitioner.email && <Text>Email: {practitioner.email}</Text>}
              {practitioner.siret && <Text>SIRET: {practitioner.siret}</Text>}
            </View>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>FACTURE</Text>
            <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
            {invoice.issued_at && (
              <Text style={styles.invoiceDate}>
                Date: {formatDate(invoice.issued_at)}
              </Text>
            )}
          </View>
        </View>

        {/* Client */}
        <View style={styles.clientSection}>
          <Text style={styles.sectionTitle}>Facturé à</Text>
          <Text style={styles.clientName}>
            {patient.first_name} {patient.last_name}
          </Text>
          {patient.email && <Text style={styles.clientInfo}>{patient.email}</Text>}
          {patient.phone && <Text style={styles.clientInfo}>{patient.phone}</Text>}
        </View>

        {/* Line Items */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.descriptionCol]}>
              Description
            </Text>
            <Text style={[styles.tableHeaderCell, styles.amountCol]}>Montant</Text>
          </View>

          <View style={styles.tableRow}>
            <View style={styles.descriptionCol}>
              <Text style={styles.description}>Consultation ostéopathique</Text>
              <Text style={styles.descriptionDetail}>
                Date: {formatDate(consultation.date_time)}
              </Text>
              <Text style={styles.descriptionDetail}>
                Motif: {consultation.reason}
              </Text>
            </View>
            <Text style={styles.amountCol}>{formatCurrency(invoice.amount)}</Text>
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalAmount}>{formatCurrency(invoice.amount)}</Text>
          </View>
        </View>

        {/* Payments */}
        {payments.length > 0 && (
          <View style={styles.paymentsSection}>
            <Text style={styles.sectionTitle}>Paiements reçus</Text>
            {payments.map((payment, index) => (
              <View key={index} style={styles.paymentRow}>
                <Text style={styles.paymentMethod}>
                  {paymentMethodLabels[payment.method]} -{' '}
                  {formatDate(payment.payment_date)}
                </Text>
                <Text style={styles.paymentAmount}>
                  {formatCurrency(payment.amount)}
                </Text>
              </View>
            ))}
            <View
              style={[
                styles.paymentRow,
                { borderTopWidth: 1, borderTopColor: '#bbf7d0', marginTop: 8, paddingTop: 8 },
              ]}
            >
              <Text style={[styles.paymentMethod, { fontWeight: 'bold' }]}>
                Total payé
              </Text>
              <Text style={[styles.paymentAmount, { fontWeight: 'bold' }]}>
                {formatCurrency(totalPaid)}
              </Text>
            </View>
          </View>
        )}

        {/* Note */}
        {invoice.notes && (
          <View style={styles.note}>
            <Text>Note: {invoice.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          {practitioner.practice_name ||
            `${practitioner.first_name} ${practitioner.last_name}`}
          {practitioner.siret && ` - SIRET: ${practitioner.siret}`}
          {'\n'}
          TVA non applicable, art. 261, 4-1° du CGI
        </Text>
      </Page>
    </Document>
  )
}
