import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Claude Chat → Vercel Deploy',
  description: 'Transform Claude Chat JSX artifacts into deployable Next.js apps on Vercel',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'JSX Deploy',
  },
}

export const viewport: Viewport = {
  themeColor: '#e8e0f0',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-neu-base text-gray-700 min-h-screen">
        {children}
      </body>
    </html>
  )
}
