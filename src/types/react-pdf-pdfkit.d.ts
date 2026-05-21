declare module '@react-pdf/pdfkit' {
  import PDFKitDocument from 'pdfkit'
  export default PDFKitDocument
}

declare module '*.png' {
  import { StaticImageData } from 'next/image'
  const content: StaticImageData
  export default content
}
