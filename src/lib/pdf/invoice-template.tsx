import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'

// Simple data interface - only primitive types
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

const PRIMARY = '#10B981'

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
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 6,
  },
  text: {
    fontSize: 9,
    color: '#6B7280',
    marginBottom: 2,
  },
  greenBox: {
    backgroundColor: PRIMARY,
    padding: 12,
    borderRadius: 4,
  },
  whiteText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  whiteTextSmall: {
    fontSize: 9,
    color: '#FFFFFF',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  metaBox: {
    backgroundColor: PRIMARY,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 6,
    paddingBottom: 6,
    borderRadius: 4,
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
  amountBox: {
    backgroundColor: PRIMARY,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 4,
    paddingBottom: 4,
    borderRadius: 4,
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
    backgroundColor: PRIMARY,
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
  badge: {
    backgroundColor: PRIMARY,
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 3,
    paddingBottom: 3,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9,
    color: '#FFFFFF',
  },
  stampRow: {
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

// Helper to safely get string
function str(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  return ''
}

// React Component for the PDF
export const InvoicePDFDocument: React.FC<{ data: InvoicePDFData }> = ({ data }) => {
  const practLastName = str(data.practitionerLastName).toUpperCase()
  const practFirstName = str(data.practitionerFirstName)
  const practName = practLastName + ' ' + practFirstName

  const practSpec = str(data.practitionerSpecialty)
  const practAddr = str(data.practitionerAddress)
  const practPostal = str(data.practitionerPostalCode)
  const practCity = str(data.practitionerCity)
  const practLoc = (practPostal + ' ' + practCity).trim()
  const practSiren = data.practitionerSiret ? 'N SIREN: ' + str(data.practitionerSiret) : ''
  const practRpps = data.practitionerRpps ? 'N RPPS: ' + str(data.practitionerRpps) : ''

  const patLastName = str(data.patientLastName).toUpperCase()
  const patFirstName = str(data.patientFirstName)
  const patName = patLastName + ' ' + patFirstName
  const patEmail = str(data.patientEmail)

  const location = practCity || 'Paris'
  const dateStr = str(data.invoiceDate)
  const invNum = str(data.invoiceNumber)

  const consultReason = str(data.consultationReason) || 'Consultation'
  const reason = 'Seance du jour - ' + consultReason

  const amountNum = typeof data.invoiceAmount === 'number' ? data.invoiceAmount : 0
  const amount = amountNum.toFixed(2) + ' EUR'

  const method = str(data.paymentMethod) || 'Comptant'
  const payDate = str(data.paymentDate) || dateStr

  const stampUrl = str(data.practitionerStampUrl)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.leftCol}>
            <Text style={styles.title}>{practName}</Text>
            {practSpec !== '' ? <Text style={styles.subtitle}>{practSpec}</Text> : null}
            {practAddr !== '' ? <Text style={styles.text}>{practAddr}</Text> : null}
            {practLoc !== '' ? <Text style={styles.text}>{practLoc}</Text> : null}
            {practSiren !== '' ? <Text style={styles.text}>{practSiren}</Text> : null}
            {practRpps !== '' ? <Text style={styles.text}>{practRpps}</Text> : null}
          </View>
          <View style={styles.rightCol}>
            <View style={styles.greenBox}>
              <Text style={styles.whiteText}>{patName}</Text>
              {patEmail !== '' ? <Text style={styles.whiteTextSmall}>{patEmail}</Text> : null}
            </View>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaBox}>
            <Text style={styles.whiteTextSmall}>{location + ', le ' + dateStr}</Text>
          </View>
        </View>

        <View style={styles.invoiceRow}>
          <Text style={styles.invoiceLabel}>Recu d honoraires n</Text>
          <View style={styles.metaBox}>
            <Text style={styles.whiteText}>{invNum}</Text>
          </View>
        </View>

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
              <View style={styles.amountBox}>
                <Text style={styles.whiteTextSmall}>{amount}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Somme a regler</Text>
          <View style={styles.totalBox}>
            <Text style={styles.totalText}>{amount}</Text>
          </View>
        </View>

        <View style={styles.paymentSection}>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Reglement</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{method}</Text>
            </View>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Type de reglement</Text>
            <Text style={styles.paymentValue}>Comptant</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Date du reglement</Text>
            <Text style={styles.paymentValue}>{payDate}</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Date de facturation</Text>
            <Text style={styles.paymentValue}>{dateStr}</Text>
          </View>
        </View>

        {stampUrl !== '' ? (
          <View style={styles.stampRow}>
            <Image src={stampUrl} style={styles.stamp} />
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

// Function to create the PDF element for renderToBuffer
export function createInvoicePDF(data: InvoicePDFData): React.ReactElement {
  return React.createElement(InvoicePDFDocument, { data })
}
