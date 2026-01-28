import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'
import React from 'react'

// Simple data interface - only primitive types
export interface InvoicePDFData {
  // Invoice
  invoiceNumber: string
  invoiceAmount: number
  invoiceDate: string
  // Patient
  patientFirstName: string
  patientLastName: string
  patientEmail: string
  // Practitioner
  practitionerFirstName: string
  practitionerLastName: string
  practitionerSpecialty: string
  practitionerAddress: string
  practitionerCity: string
  practitionerPostalCode: string
  practitionerSiret: string
  practitionerRpps: string
  practitionerStampUrl: string
  // Consultation
  consultationReason: string
  // Payment
  paymentMethod: string
  paymentDate: string
}

const PRIMARY_COLOR = '#10B981'

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
    backgroundColor: PRIMARY_COLOR,
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
    backgroundColor: PRIMARY_COLOR,
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
    backgroundColor: PRIMARY_COLOR,
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
    backgroundColor: PRIMARY_COLOR,
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
    backgroundColor: PRIMARY_COLOR,
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
    backgroundColor: PRIMARY_COLOR,
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

export function InvoicePDF(data: InvoicePDFData): React.ReactElement {
  // Pre-compute all display strings
  const practFullName = String(data.practitionerLastName || '').toUpperCase() + ' ' + String(data.practitionerFirstName || '')
  const patFullName = String(data.patientLastName || '').toUpperCase() + ' ' + String(data.patientFirstName || '')
  const location = String(data.practitionerCity || 'Paris')
  const invoiceDateFormatted = String(data.invoiceDate || '')
  const amountFormatted = (typeof data.invoiceAmount === 'number' ? data.invoiceAmount.toFixed(2) : '0.00') + ' EUR'
  const reason = String(data.consultationReason || 'Consultation')
  const paymentMethodStr = String(data.paymentMethod || 'Comptant')
  const paymentDateStr = String(data.paymentDate || data.invoiceDate || '')
  const invoiceNumberStr = String(data.invoiceNumber || '')
  const specialtyStr = String(data.practitionerSpecialty || '')
  const addressStr = String(data.practitionerAddress || '')
  const postalCodeStr = String(data.practitionerPostalCode || '')
  const cityStr = String(data.practitionerCity || '')
  const siretStr = String(data.practitionerSiret || '')
  const rppsStr = String(data.practitionerRpps || '')
  const patientEmailStr = String(data.patientEmail || '')
  const stampUrlStr = String(data.practitionerStampUrl || '')

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.practitionerSection}>
            <Text style={styles.practitionerName}>{practFullName}</Text>
            {specialtyStr.length > 0 ? (
              <Text style={styles.practitionerSpecialty}>{specialtyStr}</Text>
            ) : null}
            {addressStr.length > 0 ? (
              <Text style={styles.infoText}>{addressStr}</Text>
            ) : null}
            {(postalCodeStr.length > 0 || cityStr.length > 0) ? (
              <Text style={styles.infoText}>{postalCodeStr + ' ' + cityStr}</Text>
            ) : null}
            {siretStr.length > 0 ? (
              <Text style={styles.infoText}>{'N SIREN: ' + siretStr}</Text>
            ) : null}
            {rppsStr.length > 0 ? (
              <Text style={styles.infoText}>{'N RPPS: ' + rppsStr}</Text>
            ) : null}
          </View>

          <View style={styles.patientSection}>
            <View style={styles.patientBox}>
              <Text style={styles.patientName}>{patFullName}</Text>
              {patientEmailStr.length > 0 ? (
                <Text style={styles.patientEmail}>{patientEmailStr}</Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.metaSection}>
          <View style={styles.metaBox}>
            <Text style={styles.metaText}>{location + ', le ' + invoiceDateFormatted}</Text>
          </View>
        </View>

        <View style={styles.invoiceTitle}>
          <Text style={styles.invoiceLabel}>Recu d honoraires n</Text>
          <View style={styles.invoiceNumberBox}>
            <Text style={styles.invoiceNumberText}>{invoiceNumberStr}</Text>
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
                <Text style={styles.amountText}>{amountFormatted}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>Somme a regler</Text>
          <View style={styles.totalBox}>
            <Text style={styles.totalText}>{amountFormatted}</Text>
          </View>
        </View>

        <View style={styles.paymentSection}>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Reglement</Text>
            <View style={styles.paymentBadge}>
              <Text style={styles.paymentBadgeText}>{paymentMethodStr}</Text>
            </View>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Type de reglement</Text>
            <Text style={styles.paymentValue}>Comptant</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Date du reglement</Text>
            <Text style={styles.paymentValue}>{paymentDateStr}</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Date de facturation</Text>
            <Text style={styles.paymentValue}>{invoiceDateFormatted}</Text>
          </View>
        </View>

        {stampUrlStr.length > 0 ? (
          <View style={styles.stampSection}>
            <Image src={stampUrlStr} style={styles.stampImage} />
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
