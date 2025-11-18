import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

// Construct favicon path with basePath
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/neurips2025-data-deals'
const faviconUrl = `${basePath}/favicon.ico`

export const metadata: Metadata = {
  title: 'AI Data Deals Dashboard',
  description: 'Interactive visualization of AI data deals',
  icons: {
    icon: faviconUrl,
    shortcut: faviconUrl,
    apple: faviconUrl,
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

