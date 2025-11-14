"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

interface V2ContextType {
  v2Enabled: boolean
  setV2Enabled: (enabled: boolean) => void
}

const V2Context = createContext<V2ContextType | undefined>(undefined)

export function V2Provider({ children }: { children: ReactNode }) {
  const [v2Enabled, setV2EnabledState] = useState(false)

  // Load initial state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("v2Enabled")
    setV2EnabledState(stored === "true")
  }, [])

  // Update localStorage when state changes
  const setV2Enabled = (enabled: boolean) => {
    setV2EnabledState(enabled)
    localStorage.setItem("v2Enabled", String(enabled))
  }

  return <V2Context.Provider value={{ v2Enabled, setV2Enabled }}>{children}</V2Context.Provider>
}

export function useV2() {
  const context = useContext(V2Context)
  if (context === undefined) {
    throw new Error("useV2 must be used within a V2Provider")
  }
  return context
}

export const useV2Features = useV2
