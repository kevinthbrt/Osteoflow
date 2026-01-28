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

// Helper function to ensure string
function toStr(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return ''
}

// Main function that creates the PDF document directly
export function createInvoicePDF(d: InvoicePDFData) {
  // Pre-compute ALL strings
  const practLastName = toStr(d.practitionerLastName).toUpperCase()
  const practFirstName = toStr(d.practitionerFirstName)
  const practName = practLastName + ' ' + practFirstName

  const practSpec = toStr(d.practitionerSpecialty)
  const practAddr = toStr(d.practitionerAddress)
  const practPostal = toStr(d.practitionerPostalCode)
  const practCity = toStr(d.practitionerCity)
  const practLoc = (practPostal + ' ' + practCity).trim()
  const practSiret = toStr(d.practitionerSiret)
  const practRpps = toStr(d.practitionerRpps)
  const practSiren = practSiret ? 'N SIREN: ' + practSiret : ''
  const practRppsStr = practRpps ? 'N RPPS: ' + practRpps : ''

  const patLastName = toStr(d.patientLastName).toUpperCase()
  const patFirstName = toStr(d.patientFirstName)
  const patName = patLastName + ' ' + patFirstName
  const patEmail = toStr(d.patientEmail)

  const city = practCity || 'Paris'
  const dateStr = toStr(d.invoiceDate)
  const invNum = toStr(d.invoiceNumber)
  const consultReason = toStr(d.consultationReason) || 'Consultation'
  const reason = 'Seance du jour - ' + consultReason
  const amountNum = typeof d.invoiceAmount === 'number' ? d.invoiceAmount : 0
  const amt = amountNum.toFixed(2) + ' EUR'
  const method = toStr(d.paymentMethod) || 'Comptant'
  const payDate = toStr(d.paymentDate) || dateStr
  const stampUrl = toStr(d.practitionerStampUrl)

  // Build info lines array
  const lines: string[] = []
  if (practSpec) lines.push(practSpec)
  if (practAddr) lines.push(practAddr)
  if (practLoc) lines.push(practLoc)
  if (practSiren) lines.push(practSiren)
  if (practRppsStr) lines.push(practRppsStr)

  // Return the Document directly - no wrapper component
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.leftCol}>
            <Text style={styles.title}>{practName}</Text>
            {lines.length > 0 && lines.map((line, idx) => (
              <Text key={'line-' + String(idx)} style={styles.text}>{line}</Text>
            ))}
          </View>
          <View style={styles.rightCol}>
            <View style={styles.greenBox}>
              <Text style={styles.whiteText}>{patName}</Text>
              <Text style={styles.whiteTextSmall}>{patEmail}</Text>
            </View>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.greenBox}>
            <Text style={styles.whiteTextSmall}>{city + ', le ' + dateStr}</Text>
          </View>
        </View>

        <View style={styles.invoiceRow}>
          <Text style={styles.invoiceLabel}>Recu d honoraires n</Text>
          <View style={styles.greenBox}>
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
              <View style={styles.greenBox}>
                <Text style={styles.whiteTextSmall}>{amt}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Somme a regler</Text>
          <View style={styles.totalBox}>
            <Text style={styles.totalText}>{amt}</Text>
          </View>
        </View>

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

        {stampUrl !== '' ? (
          <View style={styles.stampContainer}>
            <Image src={stampUrl} style={styles.stamp} />
          </View>
        ) : (
          <View />
        )}

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
