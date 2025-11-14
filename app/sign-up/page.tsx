import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center mb-2">
            <Image src="/jak-labs-logo.png" alt="JAK Labs" width={120} height={60} className="object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold">Create Your Account</CardTitle>
          <CardDescription>Join JAK Labs to start coaching your athletes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" type="text" placeholder="John Doe" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" type="email" placeholder="coach@example.com" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="practiceName">Practice Name</Label>
            <Input id="practiceName" type="text" placeholder="Your Practice Name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="Create a strong password" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input id="confirmPassword" type="password" placeholder="Confirm your password" required />
          </div>
          <Button className="w-full" size="lg">
            Create Account
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-muted-foreground">
            Already have an account?{" "}
            <Link href="/sign-in" className="font-medium text-foreground hover:underline">
              Sign in
            </Link>
          </div>
          <div className="text-xs text-center text-muted-foreground">
            By signing up, you agree to our Terms of Service and Privacy Policy
          </div>
          <div className="text-xs text-center text-muted-foreground">Powered by JAK Labs</div>
        </CardFooter>
      </Card>
    </div>
  )
}
