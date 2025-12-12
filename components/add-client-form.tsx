"use client"

import type React from "react"

import { useState } from "react"
import { CreditCard, User, FileText, Package, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useV2 } from "@/lib/v2-context"

interface AddClientFormProps {
  onClientAdded?: () => void
  onSuccess?: () => void
}

export default function AddClientForm({ onClientAdded, onSuccess }: AddClientFormProps) {
  const { v2Enabled } = useV2()

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    sportType: "",
    notes: "",
    plan: "standard",
    cardNumber: "",
    cardExpiry: "",
    cardCvv: "",
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/clients/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          sportType: formData.sportType || undefined,
          notes: formData.notes || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to add client")
        setIsSubmitting(false)
        return
      }

      // Check for SES sandbox warning
      if (data.warning && data.error?.includes('SES Sandbox Mode')) {
        setError(
          `Client added to database, but email not sent. ${data.warning} The signup link is: ${data.signupUrl}`
        )
        setIsSubmitting(false)
        return
      }

      if (data.warning) {
        setSuccess(`Client added! ${data.message}. ${data.warning}`)
      } else {
        setSuccess("Client added successfully! Invitation email has been sent.")
      }
      
      // Reset form
      setFormData({
        name: "",
        email: "",
        sportType: "",
        notes: "",
        plan: "standard",
        cardNumber: "",
        cardExpiry: "",
        cardCvv: "",
      })

      // Call callbacks after 2 seconds
      setTimeout(() => {
        setSuccess("")
        if (onClientAdded) {
          onClientAdded()
        }
        if (onSuccess) {
          onSuccess()
        }
      }, 2000)
    } catch (err: any) {
      setError(err.message || "An error occurred while adding the client")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="h-full flex flex-col w-full">
      <div className="sticky top-0 z-10 bg-muted border-b border-border/30 px-6 py-4 w-full">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Add New Client</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {v2Enabled ? "Add a client and set up their subscription payment" : "Add a new client to your roster"}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 w-full">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert variant="default" className="mb-4 border-green-500 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit} className="space-y-6 w-full">
          {/* Client Information Section */}
          <div className="space-y-4 w-full">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <User className="size-5" />
              <h3>Client Information</h3>
            </div>

            <div className="space-y-2 w-full">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                required
                className="w-full"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div className="space-y-2 w-full">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="john.doe@email.com"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                required
                className="w-full"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div className="space-y-2 w-full">
              <Label htmlFor="sportType">Sport Type</Label>
              <Select value={formData.sportType} onValueChange={(value) => handleInputChange("sportType", value)}>
                <SelectTrigger id="sportType" className="!w-full">
                  <SelectValue placeholder="Select a sport" />
                </SelectTrigger>
                <SelectContent className="!z-[200]" position="popper" style={{ zIndex: 200 }}>
                  <SelectItem value="basketball">Basketball</SelectItem>
                  <SelectItem value="football">Football</SelectItem>
                  <SelectItem value="soccer">Soccer</SelectItem>
                  <SelectItem value="baseball">Baseball</SelectItem>
                  <SelectItem value="tennis">Tennis</SelectItem>
                  <SelectItem value="golf">Golf</SelectItem>
                  <SelectItem value="swimming">Swimming</SelectItem>
                  <SelectItem value="track-field">Track & Field</SelectItem>
                  <SelectItem value="volleyball">Volleyball</SelectItem>
                  <SelectItem value="hockey">Hockey</SelectItem>
                  <SelectItem value="lacrosse">Lacrosse</SelectItem>
                  <SelectItem value="rugby">Rugby</SelectItem>
                  <SelectItem value="wrestling">Wrestling</SelectItem>
                  <SelectItem value="boxing">Boxing</SelectItem>
                  <SelectItem value="mma">MMA</SelectItem>
                  <SelectItem value="crossfit">CrossFit</SelectItem>
                  <SelectItem value="powerlifting">Powerlifting</SelectItem>
                  <SelectItem value="weightlifting">Weightlifting</SelectItem>
                  <SelectItem value="cycling">Cycling</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="triathlon">Triathlon</SelectItem>
                  <SelectItem value="skiing">Skiing</SelectItem>
                  <SelectItem value="snowboarding">Snowboarding</SelectItem>
                  <SelectItem value="surfing">Surfing</SelectItem>
                  <SelectItem value="skateboarding">Skateboarding</SelectItem>
                  <SelectItem value="climbing">Climbing</SelectItem>
                  <SelectItem value="gymnastics">Gymnastics</SelectItem>
                  <SelectItem value="dance">Dance</SelectItem>
                  <SelectItem value="martial-arts">Martial Arts</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 w-full">
              <Label htmlFor="notes">Client Notes</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this client (goals, injuries, preferences, etc.)"
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                rows={4}
                className="resize-none w-full"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {v2Enabled && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Package className="size-5" />
                <h3>Subscription Plan</h3>
              </div>

              <RadioGroup value={formData.plan} onValueChange={(value) => handleInputChange("plan", value)}>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                    <RadioGroupItem value="basic" id="basic" />
                    <Label htmlFor="basic" className="flex-1 cursor-pointer">
                      <div className="font-semibold">Basic Plan</div>
                      <div className="text-sm text-muted-foreground">$99/month - Essential features</div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                    <RadioGroupItem value="standard" id="standard" />
                    <Label htmlFor="standard" className="flex-1 cursor-pointer">
                      <div className="font-semibold">Standard Plan</div>
                      <div className="text-sm text-muted-foreground">$199/month - Most popular</div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                    <RadioGroupItem value="premium" id="premium" />
                    <Label htmlFor="premium" className="flex-1 cursor-pointer">
                      <div className="font-semibold">Premium Plan</div>
                      <div className="text-sm text-muted-foreground">$299/month - Full access</div>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>
          )}

          {v2Enabled && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <CreditCard className="size-5" />
                <h3>Payment Information</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cardNumber">Card Number *</Label>
                <Input
                  id="cardNumber"
                  placeholder="1234 5678 9012 3456"
                  value={formData.cardNumber}
                  onChange={(e) => handleInputChange("cardNumber", e.target.value)}
                  maxLength={19}
                  required
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cardExpiry">Expiry Date *</Label>
                  <Input
                    id="cardExpiry"
                    placeholder="MM/YY"
                    value={formData.cardExpiry}
                    onChange={(e) => handleInputChange("cardExpiry", e.target.value)}
                    maxLength={5}
                    required
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cardCvv">CVV *</Label>
                  <Input
                    id="cardCvv"
                    placeholder="123"
                    value={formData.cardCvv}
                    onChange={(e) => handleInputChange("cardCvv", e.target.value)}
                    maxLength={4}
                    required
                    className="w-full"
                  />
                </div>
              </div>

              <div className="bg-muted/50 border border-border rounded-lg p-4 mt-4">
                <div className="flex items-start gap-2">
                  <FileText className="size-4 mt-0.5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Payment will be securely processed by the jak platform. The client will be charged automatically
                    each month.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-4 border-t border-border">
            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending Invitation...
                </>
              ) : (
                v2Enabled ? "Add Client & Process Payment" : "Add Client"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}






