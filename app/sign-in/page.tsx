"use client"

import type React from "react"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

const VALID_CREDENTIALS = [
  { email: "coach@jaklabs.com", password: "password123" },
  { email: "pierre.devaris@jaklabs.com", password: "demo1234" },
  { email: "demo@jaklabs.com", password: "jaklabs2024" },
]

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Check if credentials match any valid credentials
    const isValid = VALID_CREDENTIALS.some((cred) => cred.email === email && cred.password === password)

    if (isValid) {
      // Store auth state in localStorage (will be replaced with AWS Cognito later)
      localStorage.setItem("isAuthenticated", "true")
      localStorage.setItem("userEmail", email)

      // Redirect to dashboard
      router.push("/")
    } else {
      setError("Invalid email or password. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center mb-2">
            <Image src="/jak-labs-logo.png" alt="JAK Labs" width={120} height={60} className="object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription>Sign in to your coach account to continue</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="coach@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button className="w-full" size="lg" type="submit" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </CardContent>
        </form>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/sign-up" className="font-medium text-foreground hover:underline">
              Sign up
            </Link>
          </div>
          <div className="text-xs text-center text-muted-foreground">Powered by JAK Labs</div>
        </CardFooter>
      </Card>
    </div>
  )
}
