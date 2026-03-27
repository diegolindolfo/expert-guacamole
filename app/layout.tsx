import type { Metadata, Viewport } from 'next'
import './globals.css'
import Nav from '@/components/Nav'

export const metadata: Metadata = {
  title: { default: 'Clarice', template: '%s — Clarice' },
  description: 'Sistema de gerenciamento de biblioteca escolar',
  robots: 'noindex, nofollow',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Nav />
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  )
}
