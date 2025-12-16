"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2 } from "lucide-react"

export default function CoachSignUpPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [verificationCode, setVerificationCode] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [inviteToken, setInviteToken] = useState<string | null>(null)

  // Check for invite parameters in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const invite = params.get("invite")
    const inviteEmail = params.get("email")
    
    if (invite && inviteEmail) {
      setInviteToken(invite)
      setEmail(inviteEmail)
      // Note: Invites are typically for members, but we'll allow coach signup with invite
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setIsLoading(true)

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    // Validate password length
    if (password.length < 8) {
      setError("Password must be at least 8 characters long")
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          fullName,
          userType: "coach", // Hardcoded to coach
          inviteToken: inviteToken || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to create account")
        setIsLoading(false)
        return
      }

      setSuccess("Account created successfully!")
      setIsLoading(false)
    } catch (err: any) {
      setError(err.message || "An error occurred during sign up")
      setIsLoading(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsVerifying(true)

    if (!verificationCode || verificationCode.length !== 6) {
      setError("Please enter a valid 6-digit confirmation code")
      setIsVerifying(false)
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
          code: verificationCode,
          fullName,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to verify email")
        setIsVerifying(false)
        return
      }

      setIsVerified(true)
      setIsVerifying(false)
      
      // Redirect to sign-in after 2 seconds
      setTimeout(() => {
        router.push("/sign-in?verified=true")
      }, 2000)
    } catch (err: any) {
      setError(err.message || "An error occurred during verification")
      setIsVerifying(false)
    }
  }

  const handleResendCode = async () => {
    if (!email) {
      setError("Email address is required")
      return
    }

    setIsResending(true)
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
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center mb-2">
            <Image src="/jak-labs-logo.png" alt="JAK Labs" width={120} height={60} className="object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold">Create Your Coach Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {isVerified ? (
            <Alert variant="default" className="border-green-500 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 space-y-2">
                <p className="font-semibold">Email Verified Successfully!</p>
                <p className="text-sm">Redirecting to sign in...</p>
              </AlertDescription>
            </Alert>
          ) : success ? (
            <>
              <Alert variant="default" className="border-green-500 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 space-y-2">
                  <p className="font-semibold">{success}</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <p>A confirmation email has been sent to <strong>{email}</strong>.</p>
                    <p className="text-muted-foreground">
                      Please enter the 6-digit code from your email below.
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                      <li>If you don't see the email, please check your spam/junk folder</li>
                      <li>It may take up to 5 minutes for the email to arrive</li>
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="verificationCode">Confirmation Code</Label>
                  <Input
                    id="verificationCode"
                    type="text"
                    placeholder="123456"
                    value={verificationCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "").slice(0, 6)
                      setVerificationCode(value)
                    }}
                    maxLength={6}
                    required
                    className="text-center text-2xl tracking-widest font-mono"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Enter the 6-digit code from your email
                  </p>
                </div>
                <Button className="w-full" size="lg" type="submit" disabled={isVerifying || verificationCode.length !== 6}>
                  {isVerifying ? "Verifying..." : "Verify Email"}
                </Button>
                <div className="text-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResendCode}
                    disabled={isResending}
                    className="w-full"
                  >
                    {isResending ? "Resending..." : "Resend Code"}
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {inviteToken && (
                <Alert variant="default" className="border-blue-500 bg-blue-50">
                  <AlertDescription className="text-blue-800">
                    You've been invited to join! Please complete your registration below.
                  </AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="coach@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={!!inviteToken}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a strong password (min. 8 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <Button className="w-full" size="lg" type="submit" disabled={isLoading}>
                {isLoading ? "Creating Account..." : "Create Account"}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          {!success && (
            <div className="text-sm text-center text-muted-foreground">
              Already have an account?{" "}
              <Link href="/sign-in" className="font-medium text-foreground hover:underline">
                Sign in
              </Link>
            </div>
          )}
          {success && !isVerified && (
            <div className="text-sm text-center text-muted-foreground">
              Already verified?{" "}
              <Link href="/sign-in" className="font-medium text-foreground hover:underline">
                Sign in
              </Link>
            </div>
          )}
          {isVerified && (
            <div className="text-sm text-center text-muted-foreground">
              Redirecting to sign in...
            </div>
          )}
          <div className="text-xs text-center text-muted-foreground">
            By signing up, you agree to our Terms of Service and Privacy Policy
          </div>
          <div className="text-xs text-center text-muted-foreground">Powered by JAK Labs</div>
        </CardFooter>
      </Card>
    </div>
  )
}


