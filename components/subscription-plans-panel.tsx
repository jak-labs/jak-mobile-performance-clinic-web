"use client"

import type React from "react"

import { useState } from "react"
import { ChevronRight, ChevronLeft, Package, Plus, DollarSign, Check, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface SubscriptionPlansPanelProps {
  isOpen: boolean
  onToggle: () => void
}

interface SubscriptionPlan {
  id: string
  name: string
  price: number
  features: string[]
  isPopular?: boolean
}

export default function SubscriptionPlansPanel({ isOpen, onToggle }: SubscriptionPlansPanelProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([
    {
      id: "basic",
      name: "Basic",
      price: 99,
      features: ["Up to 5 active clients", "Basic performance tracking", "Email support", "Monthly progress reports"],
    },
    {
      id: "standard",
      name: "Standard",
      price: 199,
      features: [
        "Up to 15 active clients",
        "Advanced performance analytics",
        "Priority email support",
        "Weekly progress reports",
        "Custom protocol builder",
        "Video library access",
      ],
      isPopular: true,
    },
    {
      id: "premium",
      name: "Premium",
      price: 299,
      features: [
        "Unlimited active clients",
        "Real-time performance monitoring",
        "24/7 priority support",
        "Daily progress reports",
        "Custom protocol builder",
        "Full video library access",
        "AI-powered insights",
        "White-label branding",
      ],
    },
  ])

  const [isAddingNew, setIsAddingNew] = useState(false)
  const [newPlan, setNewPlan] = useState({
    name: "",
    price: "",
    features: [""],
  })

  const handleAddFeature = () => {
    setNewPlan((prev) => ({
      ...prev,
      features: [...prev.features, ""],
    }))
  }

  const handleRemoveFeature = (index: number) => {
    setNewPlan((prev) => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index),
    }))
  }

  const handleFeatureChange = (index: number, value: string) => {
    setNewPlan((prev) => ({
      ...prev,
      features: prev.features.map((feature, i) => (i === index ? value : feature)),
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const plan: SubscriptionPlan = {
      id: newPlan.name.toLowerCase().replace(/\s+/g, "-"),
      name: newPlan.name,
      price: Number.parseFloat(newPlan.price),
      features: newPlan.features.filter((f) => f.trim() !== ""),
    }
    setPlans((prev) => [...prev, plan])
    setNewPlan({ name: "", price: "", features: [""] })
    setIsAddingNew(false)
    alert("Subscription plan added successfully!")
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div
      className={`relative transition-all duration-300 ease-in-out ${
        isOpen ? "w-[40%]" : "w-0"
      } border-l border-border bg-muted`}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="absolute left-0 -translate-x-1/2 top-1/2 -translate-y-1/2 z-50 h-16 w-10 rounded-full border-2 border-border bg-background shadow-lg hover:bg-background hover:shadow-xl transition-all"
      >
        {isOpen ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
      </Button>

      <div className="h-full flex flex-col">
        <div className="sticky top-0 z-10 bg-muted border-b border-border/30 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Subscription Plans</h2>
              <p className="text-sm text-muted-foreground mt-1">Manage your pricing and plan features</p>
            </div>
            {!isAddingNew && (
              <Button onClick={() => setIsAddingNew(true)} size="sm" className="gap-2">
                <Plus className="size-4" />
                New Plan
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Current Plans */}
          {!isAddingNew && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Package className="size-5" />
                Current Plans
              </h3>

              {plans.map((plan) => (
                <Card key={plan.id} className="relative">
                  {plan.isPopular && <Badge className="absolute -top-2 right-4 bg-primary">Most Popular</Badge>}
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl">{plan.name}</CardTitle>
                        <CardDescription className="flex items-baseline gap-1 mt-2">
                          <span className="text-3xl font-bold text-foreground">{formatCurrency(plan.price)}</span>
                          <span className="text-muted-foreground">/month</span>
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <Check className="size-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Add New Plan Form */}
          {isAddingNew && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Plus className="size-5" />
                  Add New Plan
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="planName">Plan Name *</Label>
                  <Input
                    id="planName"
                    placeholder="e.g., Enterprise"
                    value={newPlan.name}
                    onChange={(e) => setNewPlan((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="planPrice">Monthly Price (USD) *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="planPrice"
                      type="number"
                      placeholder="299"
                      className="pl-9"
                      value={newPlan.price}
                      onChange={(e) => setNewPlan((prev) => ({ ...prev, price: e.target.value }))}
                      required
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Plan Features *</Label>
                  <div className="space-y-2">
                    {newPlan.features.map((feature, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder="e.g., Unlimited clients"
                          value={feature}
                          onChange={(e) => handleFeatureChange(index, e.target.value)}
                          required
                        />
                        {newPlan.features.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveFeature(index)}
                            className="flex-shrink-0"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddFeature}
                    className="gap-2 mt-2 bg-transparent"
                  >
                    <Plus className="size-4" />
                    Add Feature
                  </Button>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-border">
                <Button type="submit" className="flex-1">
                  Create Plan
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddingNew(false)
                    setNewPlan({ name: "", price: "", features: [""] })
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
