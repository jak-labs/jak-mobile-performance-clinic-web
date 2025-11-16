"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { Menu, LogOut } from "lucide-react"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import Image from "next/image"
import { useV2 } from "@/lib/v2-context"

const coachNavItems = [
  { name: "Schedule", href: "/" },
  { name: "Clients", href: "/clients" },
  { name: "Offline Programs", href: "/offline-programs", v2Only: true },
  { name: "Protocols", href: "/protocols", v2Only: true },
  { name: "Revenue", href: "/revenue", v2Only: true },
  { name: "Coach Profile", href: "/profile" },
]

const memberNavItems = [
  { name: "Schedule", href: "/" },
  { name: "Member Profile", href: "/member-profile" },
]

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [isMember, setIsMember] = useState(false)
  const { v2Enabled, setV2Enabled } = useV2()

  // Fetch user groups to determine navigation items
  useEffect(() => {
    const fetchUserGroups = async () => {
      try {
        const response = await fetch("/api/auth/user-groups")
        if (response.ok) {
          const data = await response.json()
          setIsMember(data.isMember || false)
        }
      } catch (error) {
        console.error("Error fetching user groups:", error)
      }
    }
    if (session) {
      fetchUserGroups()
    }
  }, [session])

  const handleSignOut = async () => {
    setOpen(false)
    await signOut({ redirect: false })
    router.push("/sign-in")
  }

  const navItems = isMember ? memberNavItems : coachNavItems
  const visibleNavItems = navItems.filter((item) => !('v2Only' in item) || (item.v2Only && v2Enabled))

  const isAuthPage = pathname === "/sign-in" || pathname === "/sign-up"
  const isSessionPage = pathname?.startsWith("/session/")

  if (isAuthPage || isSessionPage) {
    return null
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 size-10 rounded-lg bg-background/80 backdrop-blur-sm border border-border/40 hover:bg-accent"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" />
        <span className="sr-only">Open menu</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation Menu</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col h-full">
            {/* Logo section */}
            <div className="flex flex-col gap-3 p-6 border-b border-border/40">
              <Link href="/" onClick={() => setOpen(false)}>
                <Image src="/jak-labs-logo.png" alt="JAK Labs" width={120} height={40} className="h-10 w-auto" />
              </Link>

              {!isMember && (
                <div className="flex items-center justify-between">
                  <Label htmlFor="v2-toggle" className="text-sm text-muted-foreground cursor-pointer">
                    v2 Features
                  </Label>
                  <Switch id="v2-toggle" checked={v2Enabled} onCheckedChange={setV2Enabled} />
                </div>
              )}
            </div>

            {/* Navigation items */}
            <nav className="flex-1 p-4">
              <ul className="flex flex-col gap-2">
                {visibleNavItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center px-4 py-3 rounded-lg text-base font-medium transition-colors",
                          "hover:bg-accent hover:text-accent-foreground",
                          isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                        )}
                      >
                        {item.name}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>

            {/* Sign out button section */}
            <div className="p-4 border-t border-border/40">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-base font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <LogOut className="size-5" />
                Sign Out
              </button>
            </div>

            {/* Footer section */}
            <div className="p-6 border-t border-border/40">
              <p className="text-xs text-muted-foreground">Powered by JAK Labs</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
