"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Mail, Award, Building2, ShoppingCart, Crown } from "lucide-react"
import { useV2 } from "@/lib/v2-context"

export default function CoachProfile() {
  const { v2Enabled } = useV2()

  const coachData = {
    name: "Pierre Devaris",
    initials: "PD",
    specialty: "Sports Performance & Rehabilitation",
    practiceName: "JAK Labs Performance Center",
    email: "pierre.devaris@jaklabs.com",
    subscription: "Premium",
    certifications: ["CSCS", "DPT", "ATC"],
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 pl-12">
          <h1 className="text-4xl font-bold mb-2">Coach Profile</h1>
          <p className="text-muted-foreground text-lg">Manage your profile and subscription</p>
        </div>

        <div className="space-y-6">
          {/* Main Profile Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-6">
                  <Avatar className="size-24">
                    <AvatarImage src="/placeholder.svg?height=96&width=96" alt={coachData.name} />
                    <AvatarFallback className="text-2xl font-semibold">{coachData.initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-3xl mb-2">{coachData.name}</CardTitle>
                    {v2Enabled && (
                      <>
                        <CardDescription className="text-lg mb-3">{coachData.specialty}</CardDescription>
                        <div className="flex flex-wrap gap-2">
                          {coachData.certifications.map((cert) => (
                            <Badge key={cert} variant="secondary" className="gap-1.5">
                              <Award className="size-3" />
                              {cert}
                            </Badge>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Building2 className="size-5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Practice</p>
                    <p className="text-sm">{coachData.practiceName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Mail className="size-5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Email</p>
                    <p className="text-sm">{coachData.email}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Info Card */}
          {v2Enabled && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="size-5" />
                  Subscription Information
                </CardTitle>
                <CardDescription>Your current plan and benefits</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-semibold text-lg">Premium Plan</p>
                      <p className="text-sm text-muted-foreground">Full access to all features and integrations</p>
                    </div>
                    <Badge variant="default" className="text-base px-4 py-2">
                      Active
                    </Badge>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="p-3 rounded-lg border bg-card">
                      <p className="text-sm text-muted-foreground mb-1">Unlimited Athletes</p>
                      <p className="text-2xl font-bold">∞</p>
                    </div>
                    <div className="p-3 rounded-lg border bg-card">
                      <p className="text-sm text-muted-foreground mb-1">Smart Tape Integration</p>
                      <p className="text-2xl font-bold">✓</p>
                    </div>
                    <div className="p-3 rounded-lg border bg-card">
                      <p className="text-sm text-muted-foreground mb-1">Advanced Analytics</p>
                      <p className="text-2xl font-bold">✓</p>
                    </div>
                    <div className="p-3 rounded-lg border bg-card">
                      <p className="text-sm text-muted-foreground mb-1">Priority Support</p>
                      <p className="text-2xl font-bold">24/7</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Order Smart Tapes Card */}
          {v2Enabled && (
            <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="size-5" />
                  Smart Tape Equipment
                </CardTitle>
                <CardDescription>Order additional smart tape sensors for your athletes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Expand your monitoring capabilities with additional smart tape sensors. Each sensor provides
                      real-time biomechanical data and integrates seamlessly with your dashboard.
                    </p>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Real-time motion tracking</li>
                      <li>• Wireless connectivity</li>
                      <li>• Water-resistant design</li>
                      <li>• 12-hour battery life</li>
                    </ul>
                  </div>
                  <Button size="lg" className="gap-2 whitespace-nowrap shrink-0">
                    <ShoppingCart className="size-5" />
                    Order Smart Tapes
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
