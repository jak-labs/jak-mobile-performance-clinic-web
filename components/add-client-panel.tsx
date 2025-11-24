"use client"

import { ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import AddClientForm from "@/components/add-client-form"

interface AddClientPanelProps {
  isOpen: boolean
  onClose: () => void
  onClientAdded?: () => void
}

export default function AddClientPanel({ isOpen, onClose, onClientAdded }: AddClientPanelProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div
      className="relative transition-all duration-300 ease-in-out overflow-hidden w-[40%] border-l border-border bg-muted"
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="absolute left-0 -translate-x-1/2 top-1/2 -translate-y-1/2 z-[9999] h-16 w-10 rounded-full border-2 border-white/30 bg-background/95 backdrop-blur-sm shadow-lg hover:bg-background hover:shadow-xl transition-all"
      >
        <ChevronRight className="h-5 w-5 text-foreground" />
      </Button>

      <AddClientForm 
        onClientAdded={() => {
          onClose()
          if (onClientAdded) {
            onClientAdded()
          }
        }}
      />
    </div>
  )
}
