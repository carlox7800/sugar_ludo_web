import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sugar Ludo - Centro Oficial de Descargas y Juego Web',
  description: 'Descarga la versión oficial de Sugar Ludo para PC Windows y Android APK. Tablero hexagonal dinámico, partidas multijugador y retiros instantáneos.',
  keywords: ['Sugar Ludo', 'Ludo Parcheesi', 'Descargar Ludo PC', 'Ludo APK Android', 'Ludo Hexagonal', 'Videojuego'],
  openGraph: {
    title: 'Sugar Ludo - El Ludo Más Competitivo del Mundo',
    description: 'Descarga gratis en PC y Android o juega directamente en tu navegador web.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#05020c',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="bg-[#05020c] text-white min-h-screen selection:bg-cyan-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
