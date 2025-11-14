import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import Navigation from "@/components/navigation"
import "./globals.css"
import { Suspense } from "react"
import { V2Provider } from "@/lib/v2-context"

export const metadata: Metadata = {
  title: "JAK Labs - Athlete Performance Monitoring",
  description: "Professional athlete performance monitoring and coaching platform",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <V2Provider>
          <Suspense fallback={null}>
            <Navigation />
          </Suspense>
          {children}
        </V2Provider>
        <Analytics />
      </body>
    </html>
  )
}
