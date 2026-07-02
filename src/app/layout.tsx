import type { Metadata } from 'next'
import { Playfair_Display } from 'next/font/google'
import '@/styles/globals.css'
import { Toaster } from '@/components/ui/toaster'
import { QueryProvider } from '@/components/providers/query-provider'
import { THEME_INIT_SCRIPT } from '@/lib/theme'

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: 'MyOsteoFlow - Gestion de cabinet',
  description: "Application de gestion de cabinet d'ostéopathie",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Applique la classe `dark` avant l'hydratation React pour éviter
            un flash clair→sombre au démarrage (le rendu serveur ne connaît
            pas la préférence stockée en localStorage). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`font-sans antialiased ${playfairDisplay.variable}`} suppressHydrationWarning>
        <QueryProvider>
          {children}
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  )
}
