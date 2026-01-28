import { NextResponse } from 'next/server'
import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import React from 'react'

const styles = StyleSheet.create({
  page: { padding: 30 },
  title: { fontSize: 24, marginBottom: 10 },
  text: { fontSize: 12 },
})

export async function GET() {
  try {
    // Create a minimal PDF
    const doc = (
      <Document>
        <Page size="A4" style={styles.page}>
          <View>
            <Text style={styles.title}>Test PDF</Text>
            <Text style={styles.text}>This is a test document.</Text>
            <Text style={styles.text}>Date: {new Date().toISOString()}</Text>
          </View>
        </Page>
      </Document>
    )

    console.log('Creating PDF instance...')
    const pdfInstance = pdf(doc)
    console.log('Getting buffer...')
    const pdfStream = await pdfInstance.toBuffer()

    // Convert stream to buffer
    const chunks: Uint8Array[] = []
    for await (const chunk of pdfStream) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
    }
    const pdfBuffer = Buffer.concat(chunks)
    console.log('PDF generated, size:', pdfBuffer.length)

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="test.pdf"',
      },
    })
  } catch (error) {
    console.error('Test PDF error:', error)
    return NextResponse.json(
      { error: 'Failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
