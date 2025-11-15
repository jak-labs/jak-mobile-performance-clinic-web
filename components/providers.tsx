"use client"

import { SessionProvider } from "next-auth/react"
import { V2Provider } from "@/lib/v2-context"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <V2Provider>
        {children}
      </V2Provider>
    </SessionProvider>
  )
}

