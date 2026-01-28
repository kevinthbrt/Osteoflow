import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'

export interface InvoicePDFData {
  invoiceNumber: string
  invoiceAmount: number
  invoiceDate: string
  patientFirstName: string
  patientLastName: string
  patientEmail: string
  practitionerFirstName: string
  practitionerLastName: string
  practitionerSpecialty: string
  practitionerAddress: string
  practitionerCity: string
  practitionerPostalCode: string
  practitionerSiret: string
  practitionerRpps: string
  practitionerStampUrl: string
  consultationReason: string
  paymentMethod: string
  paymentDate: string
}

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
  leftCol: {
    width: '50%',
  },
  rightCol: {
    width: '45%',
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  text: {
    fontSize: 9,
    color: '#6B7280',
    marginBottom: 2,
  },
  greenBox: {
    backgroundColor: '#10B981',
    padding: 12,
    borderRadius: 4,
  },
  whiteText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  whiteTextSmall: {
    fontSize: 9,
    color: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  invoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  invoiceLabel: {
    fontSize: 14,
    color: '#1F2937',
    marginRight: 10,
  },
  table: {
    marginBottom: 20,
  },
  tableHead: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 8,
    marginBottom: 8,
  },
  tableHeadText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  tableRow: {
    flexDirection: 'row',
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  descCol: {
    width: '70%',
  },
  amountCol: {
    width: '30%',
    alignItems: 'flex-end',
  },
  itemText: {
    fontSize: 11,
    color: '#1F2937',
  },
  totalRow: {
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
    backgroundColor: '#10B981',
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
  },
  stampContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    marginBottom: 30,
  },
  stamp: {
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

// Helper - ensure string
const s = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : ''
}

// Stamp component - only renders if URL exists
const StampImage = ({ url }: { url: string }) => {
  if (!url || url === '') return null
  return (
    <View style={styles.stampContainer}>
      <Image src={url} style={styles.stamp} />
    </View>
  )
}

// PDF Document Component
const InvoiceDoc = ({ d }: { d: InvoicePDFData }) => {
  // Pre-compute ALL strings
  const practName = s(d.practitionerLastName).toUpperCase() + ' ' + s(d.practitionerFirstName)
  const practSpec = s(d.practitionerSpecialty)
  const practAddr = s(d.practitionerAddress)
  const practLoc = (s(d.practitionerPostalCode) + ' ' + s(d.practitionerCity)).trim()
  const practSiren = d.practitionerSiret ? 'N SIREN: ' + s(d.practitionerSiret) : ''
  const practRpps = d.practitionerRpps ? 'N RPPS: ' + s(d.practitionerRpps) : ''

  const patName = s(d.patientLastName).toUpperCase() + ' ' + s(d.patientFirstName)
  const patEmail = s(d.patientEmail)

  const city = s(d.practitionerCity) || 'Paris'
  const dateStr = s(d.invoiceDate)
  const invNum = s(d.invoiceNumber)
  const reason = 'Seance du jour - ' + (s(d.consultationReason) || 'Consultation')
  const amt = (typeof d.invoiceAmount === 'number' ? d.invoiceAmount : 0).toFixed(2) + ' EUR'
  const method = s(d.paymentMethod) || 'Comptant'
  const payDate = s(d.paymentDate) || dateStr
  const stampUrl = s(d.practitionerStampUrl)

  // Build practitioner info lines
  const infoLines: string[] = []
  if (practSpec) infoLines.push(practSpec)
  if (practAddr) infoLines.push(practAddr)
  if (practLoc) infoLines.push(practLoc)
  if (practSiren) infoLines.push(practSiren)
  if (practRpps) infoLines.push(practRpps)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.leftCol}>
            <Text style={styles.title}>{practName}</Text>
            {infoLines.map((line, i) => (
              <Text key={String(i)} style={styles.text}>{line}</Text>
            ))}
          </View>
          <View style={styles.rightCol}>
            <View style={styles.greenBox}>
              <Text style={styles.whiteText}>{patName}</Text>
              <Text style={styles.whiteTextSmall}>{patEmail}</Text>
            </View>
          </View>
        </View>

        {/* Date */}
        <View style={styles.row}>
          <View style={styles.greenBox}>
            <Text style={styles.whiteTextSmall}>{city + ', le ' + dateStr}</Text>
          </View>
        </View>

        {/* Invoice number */}
        <View style={styles.invoiceRow}>
          <Text style={styles.invoiceLabel}>Recu d honoraires n</Text>
          <View style={styles.greenBox}>
            <Text style={styles.whiteText}>{invNum}</Text>
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <View style={styles.descCol}>
              <Text style={styles.tableHeadText}>DESCRIPTION</Text>
            </View>
            <View style={styles.amountCol}>
              <Text style={styles.tableHeadText}>MONTANT</Text>
            </View>
          </View>
          <View style={styles.tableRow}>
            <View style={styles.descCol}>
              <Text style={styles.itemText}>{reason}</Text>
            </View>
            <View style={styles.amountCol}>
              <View style={styles.greenBox}>
                <Text style={styles.whiteTextSmall}>{amt}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Total */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Somme a regler</Text>
          <View style={styles.totalBox}>
            <Text style={styles.totalText}>{amt}</Text>
          </View>
        </View>

        {/* Payment info */}
        <View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Reglement:</Text>
            <Text style={styles.paymentValue}>{method}</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Date du reglement:</Text>
            <Text style={styles.paymentValue}>{payDate}</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Date de facturation:</Text>
            <Text style={styles.paymentValue}>{dateStr}</Text>
          </View>
        </View>

        {/* Stamp */}
        <StampImage url={stampUrl} />

        {/* Footer */}
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

// Export function that creates the PDF element
export function createInvoicePDF(data: InvoicePDFData): React.ReactElement {
  return React.createElement(InvoiceDoc, { d: data })
}
