"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { Menu, LogOut, Moon, Sun } from "lucide-react"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import Image from "next/image"
import { useV2 } from "@/lib/v2-context"
import { useTheme } from "next-themes"

const coachNavItems = [
  { name: "Schedule", href: "/" },
  { name: "Clients", href: "/clients" },
  { name: "Exercises", href: "/exercises" },
  { name: "Offline Programs", href: "/offline-programs", v2Only: true },
  { name: "Protocols", href: "/protocols", v2Only: true },
  { name: "Revenue", href: "/revenue", v2Only: true },
  { name: "Coach Profile", href: "/profile" },
]

const memberNavItems = [
  { name: "Schedule", href: "/" },
  { name: "Prescribed Exercises", href: "/prescribed-exercises" },
  { name: "Member Profile", href: "/member-profile" },
]

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [isMember, setIsMember] = useState(false)
  const [unassignedCount, setUnassignedCount] = useState(0)
  const { v2Enabled, setV2Enabled } = useV2()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

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

  // Fetch unassigned clients count (only for coaches)
  useEffect(() => {
    const fetchUnassignedCount = async () => {
      if (isMember || !session) return
      try {
        const response = await fetch("/api/subjects")
        if (response.ok) {
          const data = await response.json()
          setUnassignedCount(data.unassignedSubjects?.length || 0)
        }
      } catch (error) {
        console.error("Error fetching unassigned count:", error)
      }
    }
    if (!isMember && session) {
      fetchUnassignedCount()
      // Refresh count every 30 seconds
      const interval = setInterval(fetchUnassignedCount, 30000)
      return () => clearInterval(interval)
    }
  }, [session, isMember])

  const handleSignOut = async () => {
    setOpen(false)
    await signOut({ redirect: false })
    router.push("/sign-in")
  }

  const navItems = isMember ? memberNavItems : coachNavItems
  const visibleNavItems = navItems.filter((item) => !('v2Only' in item) || (item.v2Only && v2Enabled))

  const isAuthPage = pathname === "/sign-in" || 
                     pathname === "/sign-up" || 
                     pathname === "/coach-signup" || 
                     pathname === "/member-signup" ||
                     pathname === "/forgot-password" ||
                     pathname === "/verify-email"
  const isSessionPage = pathname?.startsWith("/session/")

  // Don't show navigation if:
  // 1. User is not authenticated (no session)
  // 2. On auth pages
  // 3. On session pages
  if (!session || isAuthPage || isSessionPage) {
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

            </div>

            {/* Navigation items */}
            <nav className="flex-1 p-4">
              <ul className="flex flex-col gap-2">
                {visibleNavItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
                  const showUnassignedBadge = item.href === "/clients" && !isMember && unassignedCount > 0
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center justify-between px-4 py-3 rounded-lg text-base font-medium transition-colors",
                          "hover:bg-accent hover:text-accent-foreground",
                          isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                        )}
                      >
                        <span>{item.name}</span>
                        {showUnassignedBadge && (
                          <span className="ml-2 px-2 py-0.5 text-xs font-semibold text-white bg-red-500 rounded-full">
                            {unassignedCount} Un-Assigned
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>

            {/* Theme toggle and Sign out section */}
            <div className="p-4 border-t border-border/40 space-y-2">
              {mounted && (
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-base font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  {theme === "dark" ? (
                    <Sun className="size-5" />
                  ) : (
                    <Moon className="size-5" />
                  )}
                  {theme === "dark" ? "Light Mode" : "Dark Mode"}
                </button>
              )}
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
