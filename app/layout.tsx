import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import Navigation from "@/components/navigation"
import "./globals.css"
import { Suspense } from "react"
import { Providers } from "@/components/providers"

export const metadata: Metadata = {
  title: "JAK Labs - Athlete Performance Monitoring",
  description: "Professional athlete performance monitoring and coaching platform",
  generator: "v0.app",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    viewportFit: "cover",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <Providers>
          <Suspense fallback={null}>
            <Navigation />
          </Suspense>
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
