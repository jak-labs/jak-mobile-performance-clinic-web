"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

export default function MemberProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    f_name: "",
    l_name: "",
  })
  const [coach, setCoach] = useState<{ name: string; email: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/sign-in")
    }
  }, [status, router])

  useEffect(() => {
    const fetchProfile = async () => {
      if (!session?.user?.id) return

      try {
        // Fetch member profile from DynamoDB
        const response = await fetch(`/api/subjects/${session.user.id}`)
        
        if (!response.ok) {
          throw new Error("Failed to fetch profile")
        }

        const data = await response.json()
        const subject = data.subject

        console.log('Fetched subject data:', data)
        console.log('Subject coach_id:', subject?.coach_id)
        console.log('Coach data:', data.coach)

        setProfile({
          name: subject?.name || subject?.full_name || "",
          email: subject?.email || session.user.email || "",
          f_name: subject?.f_name || "",
          l_name: subject?.l_name || "",
        })

        // Set coach information if available
        if (data.coach) {
          setCoach({
            name: data.coach.name || data.coach.email,
            email: data.coach.email,
          })
        } else {
          setCoach(null)
          if (subject?.coach_id) {
            console.warn('Coach ID exists but coach profile not found. Coach ID:', subject.coach_id)
          } else {
            console.log('No coach_id in subject profile - member may have signed up directly')
          }
        }
      } catch (error) {
        console.error("Error fetching profile:", error)
        // Fallback to session data if fetch fails
        setProfile({
          name: session.user.name || "",
          email: session.user.email || "",
          f_name: "",
          l_name: "",
        })
      } finally {
        setIsLoading(false)
      }
    }

    if (session) {
      fetchProfile()
    }
  }, [session])

  const handleSave = async () => {
    if (!session?.user?.id) {
      alert("User not authenticated")
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/subjects/${session.user.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          f_name: profile.f_name,
          l_name: profile.l_name,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update profile")
      }

      const data = await response.json()
      
      // Update local state with saved data
      setProfile({
        ...profile,
        name: data.subject?.name || data.subject?.full_name || profile.name,
      })

      alert("Profile updated successfully!")
    } catch (error: any) {
      console.error("Error saving profile:", error)
      alert(error.message || "Failed to save profile")
    } finally {
      setIsSaving(false)
    }
  }

  if (status === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (status === "unauthenticated") {
    return null
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Member Profile</CardTitle>
          <CardDescription>Manage your profile information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {coach && (
            <div className="space-y-2 p-4 bg-muted rounded-lg border">
              <Label className="text-sm font-semibold text-muted-foreground">Assigned Coach</Label>
              <div className="space-y-1">
                <p className="text-base font-medium">{coach.name}</p>
                <p className="text-sm text-muted-foreground">{coach.email}</p>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" type="email" value={profile.email} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="f_name">First Name</Label>
            <Input
              id="f_name"
              type="text"
              value={profile.f_name}
              onChange={(e) => setProfile({ ...profile, f_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="l_name">Last Name</Label>
            <Input
              id="l_name"
              type="text"
              value={profile.l_name}
              onChange={(e) => setProfile({ ...profile, l_name: e.target.value })}
            />
          </div>
          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

