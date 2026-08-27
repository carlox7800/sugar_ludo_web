import type { Metadata } from 'next'
import './globals.css'
import { AdminAuthProvider } from '../lib/admin-auth-context'

export const metadata: Metadata = {
  title: 'Sugar Ludo - Hub Administrativo & Cajeros',
  description: 'Plataforma Web Maestra de Control y Gestión de Cajeros Descentralizados',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className="dark">
      <body className="bg-[#090d16] text-slate-100 min-h-screen antialiased selection:bg-cyan-500 selection:text-black">
        <AdminAuthProvider>
          {children}
        </AdminAuthProvider>
      </body>
    </html>
  )
}
