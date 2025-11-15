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
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/sign-in")
    }
  }, [status, router])

  useEffect(() => {
    const fetchProfile = async () => {
      if (!session?.user?.email) return

      try {
        // Fetch member profile from DynamoDB
        // For now, we'll use the session data
        setProfile({
          name: session.user.name || "",
          email: session.user.email || "",
          f_name: "",
          l_name: "",
        })
      } catch (error) {
        console.error("Error fetching profile:", error)
      } finally {
        setIsLoading(false)
      }
    }

    if (session) {
      fetchProfile()
    }
  }, [session])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // TODO: Implement API route to update member profile
      alert("Profile updated successfully!")
    } catch (error) {
      console.error("Error saving profile:", error)
      alert("Failed to save profile")
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

