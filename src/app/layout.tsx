import type { Metadata, Viewport } from 'next'
import { Inter, Instrument_Serif } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'
import { SWRegister } from '@/components/sw-register'

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter' })
const instrument = Instrument_Serif({ subsets: ['latin'], weight: '400', style: 'italic', variable: '--font-instrument' })

export const metadata: Metadata = {
  title: 'Tenant Portal',
  description: 'Manage your apartment lease, payments, and maintenance requests',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TenantPortal',
  },
}

// viewportFit 'cover' lets the app use the full iPhone screen; safe-area padding in globals.css keeps
// content clear of the notch and home bar. Zoom stays enabled for accessibility.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#2F4252',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${instrument.variable} h-full antialiased`}>
      <head>
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body className="app-bg min-h-full font-sans">
        {children}
        <Toaster position="top-right" />
        <SWRegister />
      </body>
    </html>
  )
}
