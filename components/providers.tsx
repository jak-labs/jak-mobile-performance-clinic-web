"use client"

import { SessionProvider } from "next-auth/react"
import { V2Provider } from "@/lib/v2-context"
import { ThemeProvider } from "@/components/theme-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <V2Provider>
          {children}
        </V2Provider>
      </ThemeProvider>
    </SessionProvider>
  )
}

