import type { Metadata } from 'next'
import { Newsreader, Inter } from 'next/font/google'
import { UserProvider } from '@/lib/UserContext'
import './globals.css'

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-serif',
  style: ['normal', 'italic'],
  weight: ['400', '500', '600'],
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'Kindr.',
  description: 'Wellness, designed for you.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Kindr.',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${inter.variable}`}>
      <body>
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  )
}
