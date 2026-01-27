import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Invoice, Patient, Practitioner, Consultation, Payment } from '@/types/database'

const paymentMethodLabels: Record<string, string> = {
  card: 'Carte bancaire',
  cash: 'Espèces',
  check: 'Chèque',
  transfer: 'Virement',
  other: 'Autre',
}

const safeText = (value: unknown): string => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }
  return ''
}

const createStyles = (accentColor: string) =>
  StyleSheet.create({
    page: {
      padding: 40,
      fontSize: 10,
      fontFamily: 'Helvetica',
      color: '#0f172a',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 18,
    },
    headerLeft: {
      width: '60%',
      paddingRight: 12,
    },
    headerRight: {
      width: '40%',
      alignItems: 'flex-end',
    },
    practitionerName: {
      fontSize: 14,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    practitionerAddress: {
      color: '#475569',
      lineHeight: 1.4,
    },
    invoiceBadge: {
      backgroundColor: '#bbf7d0',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 6,
      alignSelf: 'flex-end',
      marginBottom: 8,
    },
    invoiceTitle: {
      fontSize: 11,
      fontWeight: 'bold',
      color: accentColor,
    },
    invoiceNumber: {
      fontSize: 12,
      color: '#0f172a',
      fontWeight: 'bold',
      marginTop: 4,
      textAlign: 'right',
    },
    invoiceMeta: {
      marginTop: 6,
      color: '#475569',
      textAlign: 'right',
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 2,
    },
    metaLabel: {
      marginRight: 4,
      color: '#64748b',
    },
    clientSection: {
      marginBottom: 18,
      padding: 12,
      backgroundColor: '#ecfdf5',
      borderRadius: 6,
    },
    clientGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    sectionTitle: {
      fontSize: 9,
      color: '#64748b',
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    clientName: {
      fontSize: 12,
      fontWeight: 'bold',
    },
    clientInfo: {
      marginTop: 4,
      color: '#475569',
    },
    table: {
      marginBottom: 18,
    },
    tableHeader: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#e2e8f0',
      paddingBottom: 6,
      marginBottom: 6,
    },
    tableHeaderCell: {
      fontWeight: 'bold',
      color: '#334155',
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
      color: '#64748b',
      marginTop: 2,
      fontSize: 9,
    },
    totalRow: {
      flexDirection: 'row',
      paddingTop: 12,
      borderTopWidth: 2,
      borderTopColor: '#e2e8f0',
      alignItems: 'center',
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
      color: accentColor,
    },
    paymentSignatureRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 16,
    },
    paymentBox: {
      width: '58%',
      padding: 12,
      backgroundColor: '#f8fafc',
      borderRadius: 6,
    },
    signatureBox: {
      width: '38%',
      padding: 12,
      backgroundColor: '#f8fafc',
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    infoLabel: {
      color: '#64748b',
    },
    infoValue: {
      fontWeight: 'bold',
      color: '#0f172a',
    },
    stampImage: {
      marginTop: 6,
      maxHeight: 80,
      objectFit: 'contain',
    },
    signaturePlaceholder: {
      fontSize: 8,
      color: '#94a3b8',
      textAlign: 'center',
      marginTop: 8,
    },
    note: {
      marginTop: 16,
      padding: 10,
      backgroundColor: '#fef9c3',
      borderRadius: 4,
      fontSize: 9,
      color: '#92400e',
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
  })

interface InvoicePDFProps {
  invoice: Invoice
  consultation: Consultation
  patient: Patient
  practitioner: Practitioner
  payments: Payment[]
  stampImage?: string | null
}

export function InvoicePDF({
  invoice,
  consultation,
  patient,
  practitioner,
  payments,
  stampImage,
}: InvoicePDFProps) {
  const practitionerFirstName = safeText(practitioner.first_name)
  const practitionerLastName = safeText(practitioner.last_name)
  const practitionerName =
    safeText(practitioner.practice_name) ||
    `${practitionerFirstName} ${practitionerLastName}`.trim()
  const practitionerCity = safeText(practitioner.city)
  const practitionerPostalCode = safeText(practitioner.postal_code)
  const patientFirstName = safeText(patient.first_name)
  const patientLastName = safeText(patient.last_name)
  const patientName = `${patientFirstName} ${patientLastName}`.trim()
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const accentColor = /^#[0-9A-Fa-f]{6}$/.test(practitioner.primary_color || '')
    ? practitioner.primary_color
    : '#16a34a'
  const styles = createStyles(accentColor)
  const issuedAt = invoice.issued_at || invoice.created_at
  const latestPayment = payments.reduce<Payment | null>((latest, payment) => {
    if (!latest) return payment
    return new Date(payment.payment_date).getTime() > new Date(latest.payment_date).getTime()
      ? payment
      : latest
  }, null)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.practitionerName}>
              {practitionerName}
            </Text>
            <View style={styles.practitionerAddress}>
              {practitioner.specialty && (
                <Text>Spécialité: {safeText(practitioner.specialty)}</Text>
              )}
              {practitioner.address && (
                <Text>{safeText(practitioner.address)}</Text>
              )}
              {practitionerCity && practitionerPostalCode && (
                <Text>
                  {practitionerPostalCode} {practitionerCity}
                </Text>
              )}
              {practitioner.phone && (
                <Text>Tél: {safeText(practitioner.phone)}</Text>
              )}
              {practitioner.email && (
                <Text>Email: {safeText(practitioner.email)}</Text>
              )}
              {practitioner.siret && (
                <Text>SIRET: {safeText(practitioner.siret)}</Text>
              )}
              {practitioner.rpps && (
                <Text>RPPS: {safeText(practitioner.rpps)}</Text>
              )}
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.invoiceBadge}>
              <Text style={styles.invoiceTitle}>REÇU D'HONORAIRES</Text>
            </View>
            <Text style={styles.invoiceNumber}>
              N° {safeText(invoice.invoice_number)}
            </Text>
            <View style={styles.invoiceMeta}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Lieu:</Text>
                <Text>{practitionerCity || '—'}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Date de facturation:</Text>
                <Text>{formatDate(issuedAt)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Client */}
        <View style={styles.clientSection}>
          <Text style={styles.sectionTitle}>Facturé à</Text>
          <Text style={styles.clientName}>
            {patientName}
          </Text>
          <View style={styles.clientGrid}>
            <View>
              {patient.email && (
                <Text style={styles.clientInfo}>
                  {safeText(patient.email)}
                </Text>
              )}
              {patient.phone && (
                <Text style={styles.clientInfo}>
                  {safeText(patient.phone)}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Line Items */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.descriptionCol]}>
              Désignation
            </Text>
            <Text style={[styles.tableHeaderCell, styles.amountCol]}>Montant</Text>
          </View>

          <View style={styles.tableRow}>
            <View style={styles.descriptionCol}>
              <Text style={styles.description}>Séance d'ostéopathie</Text>
              <Text style={styles.descriptionDetail}>
                Séance du {formatDate(consultation.date_time)}
              </Text>
              {consultation.reason && (
                <Text style={styles.descriptionDetail}>
                  Motif: {safeText(consultation.reason)}
                </Text>
              )}
            </View>
            <Text style={styles.amountCol}>{formatCurrency(invoice.amount)}</Text>
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Somme à régler</Text>
            <Text style={styles.totalAmount}>{formatCurrency(invoice.amount)}</Text>
          </View>
        </View>

        {/* Payments & Signature */}
        <View style={styles.paymentSignatureRow}>
          <View style={styles.paymentBox}>
            <Text style={styles.sectionTitle}>Règlement</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Type de règlement</Text>
              <Text style={styles.infoValue}>
                {latestPayment
                  ? safeText(paymentMethodLabels[latestPayment.method])
                  : '—'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date du règlement</Text>
              <Text style={styles.infoValue}>
                {latestPayment
                  ? formatDate(latestPayment.payment_date)
                  : formatDate(issuedAt)}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Total payé</Text>
              <Text style={styles.infoValue}>{formatCurrency(totalPaid)}</Text>
            </View>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.sectionTitle}>Tampon & signature</Text>
            {stampImage ? (
              <Image src={stampImage} style={styles.stampImage} />
            ) : (
              <Text style={styles.signaturePlaceholder}>
                Ajoutez votre tampon dans les paramètres.
              </Text>
            )}
          </View>
        </View>

        {/* Note */}
        {invoice.notes && (
          <View style={styles.note}>
            <Text>Note: {invoice.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          {practitionerName}
          {practitioner.siret && ` - SIRET: ${safeText(practitioner.siret)}`}
          {'\n'}
          TVA non applicable, art. 261, 4-1° du CGI
          {'\n'}
          Absence d'escompte pour paiement anticipé
          {'\n'}
          En cas de retard, intérêts au taux minimal légal par mois de retard
          {'\n'}
          Indemnité forfaitaire de recouvrement de 40 € due
        </Text>
      </Page>
    </Document>
  )
}
