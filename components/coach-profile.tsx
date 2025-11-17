"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Mail, Award, Building2, ShoppingCart, Crown, Edit2, Check, X } from "lucide-react"
import { useV2 } from "@/lib/v2-context"
import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"

export default function CoachProfile() {
  const { v2Enabled } = useV2()
  const { data: session } = useSession()
  const [coachData, setCoachData] = useState<{
    name: string
    initials: string
    practiceName: string
    email: string
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditingPractice, setIsEditingPractice] = useState(false)
  const [practiceNameValue, setPracticeNameValue] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      if (!session?.user?.id) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)
        const response = await fetch("/api/user/profile")
        
        if (!response.ok) {
          let errorData: any = { error: 'Unknown error' }
          try {
            const text = await response.text()
            if (text) {
              errorData = JSON.parse(text)
            }
          } catch (e) {
            console.error('Failed to parse error response:', e)
          }
          
          console.error('Profile fetch error:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
            fullResponse: response
          })
          if (response.status === 404) {
            setError("Profile not found. Please complete your profile setup.")
          } else if (response.status === 401) {
            setError("Unauthorized. Please sign in again.")
          } else {
            setError(errorData.error || `Failed to fetch profile (${response.status})`)
          }
          setIsLoading(false)
          return
        }

        const data = await response.json()
        const user = data.user

        if (!user) {
          setError("Profile data is missing")
          setIsLoading(false)
          return
        }

        // Generate initials from fullName or email
        const fullName = user.fullName || ""
        const initials = fullName
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2) || user.email?.slice(0, 2).toUpperCase() || "U"

        const practiceName = user.practiceName || "Not set"
        setCoachData({
          name: user.fullName || user.email || "Unknown",
          initials,
          practiceName: practiceName,
          email: user.email || "",
        })
        setPracticeNameValue(practiceName === "Not set" ? "" : practiceName)
      } catch (err: any) {
        setError(err.message || "Failed to load profile")
        console.error("Error fetching coach profile:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [session])

  const handleSavePractice = async () => {
    if (!session?.user?.id) return

    setIsSaving(true)
    try {
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          practiceName: practiceNameValue || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to update practice name')
      }

      // Update local state
      setCoachData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          practiceName: practiceNameValue || "Not set",
        }
      })
      setIsEditingPractice(false)
    } catch (err: any) {
      console.error("Error updating practice name:", err)
      alert(err.message || "Failed to update practice name")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setPracticeNameValue(coachData?.practiceName === "Not set" ? "" : coachData?.practiceName || "")
    setIsEditingPractice(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 pl-12">
            <h1 className="text-4xl font-bold mb-2">Coach Profile</h1>
            <p className="text-muted-foreground text-lg">Manage your profile and subscription</p>
          </div>
          <Card>
            <CardContent className="p-8">
              <p className="text-muted-foreground text-center">Loading profile...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error || !coachData) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 pl-12">
            <h1 className="text-4xl font-bold mb-2">Coach Profile</h1>
            <p className="text-muted-foreground text-lg">Manage your profile and subscription</p>
          </div>
          <Card>
            <CardContent className="p-8">
              <p className="text-destructive text-center">{error || "Failed to load profile"}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
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
                        <CardDescription className="text-lg mb-3">Sports Performance & Rehabilitation</CardDescription>
                        <div className="flex flex-wrap gap-2">
                          {["CSCS", "DPT", "ATC"].map((cert) => (
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
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-foreground">Practice</p>
                      {!isEditingPractice && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditingPractice(true)}
                          className="h-6 px-2"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    {isEditingPractice ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={practiceNameValue}
                          onChange={(e) => setPracticeNameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSavePractice()
                            } else if (e.key === 'Escape') {
                              handleCancelEdit()
                            }
                          }}
                          placeholder="Enter practice name"
                          className="h-8 text-sm"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleSavePractice}
                          disabled={isSaving}
                          className="h-8 w-8 p-0"
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelEdit}
                          disabled={isSaving}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm">{coachData.practiceName}</p>
                    )}
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
