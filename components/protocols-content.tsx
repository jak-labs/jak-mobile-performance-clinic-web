"use client"

import { useState } from "react"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import ProtocolDetailPanel from "./protocol-detail-panel"

interface Protocol {
  name: string
  purpose: string
}

interface ProtocolCategory {
  id: string
  title: string
  emoji: string
  protocols: Protocol[]
}

const protocolCategories: ProtocolCategory[] = [
  {
    id: "lower-back-core",
    title: "Lower Back & Core",
    emoji: "🦵",
    protocols: [
      {
        name: "Low-Back Mobility Protocol",
        purpose: "Improve lumbar flexibility and reduce stiffness",
      },
      {
        name: "Low-Back Strength Protocol",
        purpose: "Build core and spinal stability under load",
      },
      {
        name: "Spinal Endurance Protocol",
        purpose: "Assess and train resistance to fatigue",
      },
      {
        name: "Pelvic Stability Protocol",
        purpose: "Improve hip-lumbar coordination and posture",
      },
      {
        name: "Core Activation Protocol",
        purpose: "Activate deep stabilizers (TA, multifidus) pre-exercise",
      },
      {
        name: "Posture Alignment Protocol",
        purpose: "Correct anterior/posterior pelvic tilt, trunk control",
      },
    ],
  },
  {
    id: "lower-body",
    title: "Lower Body (Legs, Hips, and Running Mechanics)",
    emoji: "🦵",
    protocols: [
      {
        name: "Hip Mobility Protocol",
        purpose: "Increase hip joint ROM and rotational control",
      },
      {
        name: "Glute Activation Protocol",
        purpose: "Enhance glute firing patterns for power and injury prevention",
      },
      {
        name: "Knee Stability Protocol",
        purpose: "Control valgus/varus motion and knee tracking",
      },
      {
        name: "Hamstring Rehab Protocol",
        purpose: "Gradual return to load post strain or tear",
      },
      {
        name: "Lower-Body Power Protocol",
        purpose: "Train and measure force production and jump efficiency",
      },
      {
        name: "Sprint Mechanics Protocol",
        purpose: "Analyze stride symmetry, acceleration, and coordination",
      },
    ],
  },
  {
    id: "upper-body",
    title: "Upper Body (Shoulder, Spine, Rotation)",
    emoji: "💪",
    protocols: [
      {
        name: "Shoulder Stability Protocol",
        purpose: "Improve rotator cuff activation and scapular control",
      },
      {
        name: "Rotational Power Protocol",
        purpose: "Measure and train rotational torque (golf, tennis, baseball)",
      },
      {
        name: "Thoracic Mobility Protocol",
        purpose: "Increase thoracic rotation and extension control",
      },
      {
        name: "Upper-Back Strength Protocol",
        purpose: "Improve scapular retraction and postural endurance",
      },
      {
        name: "Throwing Mechanics Protocol",
        purpose: "Assess kinetic chain efficiency during throwing motions",
      },
    ],
  },
  {
    id: "performance-load",
    title: "Performance & Load Tolerance",
    emoji: "⚡",
    protocols: [
      {
        name: "Explosive Power Protocol",
        purpose: "Capture max output and rate of force development",
      },
      {
        name: "Fatigue Tolerance Protocol",
        purpose: "Quantify drop-off in performance under load",
      },
      {
        name: "Symmetry & Balance Protocol",
        purpose: "Identify side-to-side discrepancies in motion and strain",
      },
      {
        name: "Dynamic Stability Protocol",
        purpose: "Evaluate control under dynamic perturbation",
      },
      {
        name: "Agility & Change of Direction Protocol",
        purpose: "Measure movement precision and reactivity",
      },
    ],
  },
  {
    id: "recovery-regeneration",
    title: "Recovery & Regeneration",
    emoji: "🧘",
    protocols: [
      {
        name: "Active Recovery Protocol",
        purpose: "Gentle movement and tissue perfusion post-load",
      },
      {
        name: "Mobility Reset Protocol",
        purpose: "Restore baseline range of motion post-session",
      },
      {
        name: "Breath & HRV Regulation Protocol",
        purpose: "Downregulate nervous system and assess recovery readiness",
      },
      {
        name: "Movement Quality Reassessment Protocol",
        purpose: "Baseline re-check after rest or rehab phase",
      },
    ],
  },
]

export default function ProtocolsContent() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  const filteredCategories = protocolCategories
    .map((category) => ({
      ...category,
      protocols: category.protocols.filter(
        (protocol) =>
          protocol.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          protocol.purpose.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    }))
    .filter((category) => category.protocols.length > 0)

  const handleProtocolClick = (protocol: Protocol) => {
    setSelectedProtocol(protocol)
    setIsPanelOpen(true)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div
        className={`transition-all duration-300 ease-in-out ${
          isPanelOpen ? "w-[60%]" : "w-full"
        } overflow-y-auto scrollbar-hide`}
      >
        <div className="min-h-screen bg-background p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8 pl-12">
              <h1 className="text-4xl font-bold mb-2">Protocols</h1>
              <p className="text-muted-foreground text-lg">Browse and manage training protocols for your athletes</p>
            </div>

            {/* Actions Bar */}
            <div className="mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search protocols..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button size="lg" className="gap-2">
                <Plus className="size-5" />
                Create Custom Protocol
              </Button>
            </div>

            {/* Protocol Categories */}
            <Accordion type="multiple" defaultValue={[]} className="space-y-4">
              {filteredCategories.map((category) => (
                <AccordionItem key={category.id} value={category.id} className="border rounded-lg bg-card">
                  <AccordionTrigger className="px-6 py-4 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{category.emoji}</span>
                      <div className="text-left">
                        <h2 className="text-xl font-semibold">{category.title}</h2>
                        <p className="text-sm text-muted-foreground">
                          {category.protocols.length} protocol
                          {category.protocols.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6">
                    <div className="grid gap-3 mt-2">
                      {category.protocols.map((protocol, index) => (
                        <div
                          key={index}
                          onClick={() => handleProtocolClick(protocol)}
                          className="p-4 rounded-lg border bg-background/50 hover:bg-background/80 transition-colors cursor-pointer group"
                        >
                          <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                            {protocol.name}
                          </h3>
                          <p className="text-muted-foreground text-sm">{protocol.purpose}</p>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {filteredCategories.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-lg">No protocols found matching your search.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ProtocolDetailPanel
        protocol={selectedProtocol}
        isOpen={isPanelOpen}
        onToggle={() => setIsPanelOpen(!isPanelOpen)}
      />
    </div>
  )
}
