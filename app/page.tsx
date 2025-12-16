"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, UserCheck } from "lucide-react"
import ScheduleContent from "@/components/schedule-content"

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "authenticated") {
      // User is logged in, show the schedule
      return
    }
  }, [status])

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // If user is authenticated, show the schedule
  if (status === "authenticated") {
    return <ScheduleContent />
  }

  // If user is not authenticated, show the sign-up selection page
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-2xl">
        <Card className="w-full">
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center mb-4">
              <Image src="/jak-labs-logo.png" alt="JAK Labs" width={120} height={60} className="object-contain" />
            </div>
            <CardTitle className="text-3xl font-bold">Welcome to JAK Labs</CardTitle>
            <CardDescription className="text-lg font-semibold text-primary">
              Unlock Your Movement Potential
            </CardDescription>
            <CardDescription className="text-base">
              Get started by selecting your account type
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Coach Sign Up */}
              <Link href="/coach-signup" className="block">
                <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-primary">
                  <CardHeader>
                    <div className="flex items-center justify-center mb-4">
                      <div className="rounded-full bg-primary/10 p-4">
                        <UserCheck className="h-8 w-8 text-primary" />
                      </div>
                    </div>
                    <CardTitle className="text-xl text-center">I'm a Coach</CardTitle>
                    <CardDescription className="text-center">
                      Create an account to manage clients, sessions, and programs
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              {/* Member/Participant Sign Up */}
              <Link href="/member-signup" className="block">
                <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-primary">
                  <CardHeader>
                    <div className="flex items-center justify-center mb-4">
                      <div className="rounded-full bg-primary/10 p-4">
                        <Users className="h-8 w-8 text-primary" />
                      </div>
                    </div>
                    <CardTitle className="text-xl text-center">I'm a Participant</CardTitle>
                    <CardDescription className="text-center">
                      Join sessions, track your progress, and work with your coach
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </div>

            <div className="text-center pt-4">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/sign-in" className="font-medium text-foreground hover:underline">
                  Sign in here
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
