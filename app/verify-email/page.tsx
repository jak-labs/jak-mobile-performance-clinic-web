"use client"

import type React from "react"
import { useState, Suspense } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2, Mail } from "lucide-react"

function VerifyEmailForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get("email") || ""
  
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [resending, setResending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    if (!code || code.length !== 6) {
      setError("Please enter a valid 6-digit confirmation code")
      setIsLoading(false)
      return
    }

    if (!email) {
      setError("Email address is required. Please sign up again.")
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          code,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to verify email")
        setIsLoading(false)
        return
      }

      setSuccess(true)
      setIsLoading(false)
      
      // Redirect to sign-in after 2 seconds
      setTimeout(() => {
        router.push("/sign-in?verified=true")
      }, 2000)
    } catch (err: any) {
      setError(err.message || "An error occurred during verification")
      setIsLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (!email) {
      setError("Email address is required")
      return
    }

    setResending(true)
    setError("")

    try {
      const response = await fetch("/api/auth/resend-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to resend code")
      } else {
        setError("")
        alert("Confirmation code has been resent to your email")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while resending the code")
    } finally {
      setResending(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center mb-2">
              <Image src="/jak-labs-logo.png" alt="JAK Labs" width={120} height={60} className="object-contain" />
            </div>
            <div className="flex justify-center">
              <CheckCircle2 className="h-16 w-16 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold">Email Verified!</CardTitle>
            <CardDescription>Your email has been successfully verified. Redirecting to sign in...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center mb-2">
            <Image src="/jak-labs-logo.png" alt="JAK Labs" width={120} height={60} className="object-contain" />
          </div>
          <div className="flex justify-center">
            <Mail className="h-12 w-12 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Verify Your Email</CardTitle>
          <CardDescription>
            {email ? (
              <>Enter the 6-digit code sent to <strong>{email}</strong></>
            ) : (
              "Enter the 6-digit confirmation code from your email"
            )}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!email && (
              <Alert variant="default" className="border-yellow-500 bg-yellow-50">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  No email address found. Please <Link href="/sign-up" className="underline font-medium">sign up</Link> first.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="code">Confirmation Code</Label>
              <Input
                id="code"
                type="text"
                placeholder="123456"
                value={code}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 6)
                  setCode(value)
                }}
                maxLength={6}
                required
                className="text-center text-2xl tracking-widest font-mono"
                disabled={!email}
              />
              <p className="text-xs text-muted-foreground text-center">
                Enter the 6-digit code from your email
              </p>
            </div>

            <Button className="w-full" size="lg" type="submit" disabled={isLoading || !email || code.length !== 6}>
              {isLoading ? "Verifying..." : "Verify Email"}
            </Button>

            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Didn't receive the code?
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResendCode}
                disabled={resending || !email}
                className="w-full"
              >
                {resending ? "Resending..." : "Resend Code"}
              </Button>
            </div>
          </CardContent>
        </form>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-muted-foreground">
            Already verified?{" "}
            <Link href="/sign-in" className="font-medium text-foreground hover:underline">
              Sign in
            </Link>
          </div>
          <div className="text-xs text-center text-muted-foreground">Powered by JAK Labs</div>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center mb-2">
              <Image src="/jak-labs-logo.png" alt="JAK Labs" width={120} height={60} className="object-contain" />
            </div>
            <CardTitle className="text-2xl font-bold">Verify Your Email</CardTitle>
            <CardDescription>Loading...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    }>
      <VerifyEmailForm />
    </Suspense>
  )
}

