import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter, Baloo_2 } from 'next/font/google'
import './globals.css'
import '../src/index.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const baloo = Baloo_2({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-baloo',
})

export const metadata: Metadata = {
  title: 'SUGAR LUDO — Cyber Candy Arena',
  description:
    'Juega Ludo en un mundo Cyber Candy: entrena contra IA, compite online y sube de nivel.',
  generator: 'v0.app',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Sugar Ludo',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#1a0f2e',
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`dark ${inter.variable} ${baloo.variable}`}>
      <body className="bg-background font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
