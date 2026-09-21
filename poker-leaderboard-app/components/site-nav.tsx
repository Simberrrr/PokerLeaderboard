"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PlusIcon, SpadeIcon, TrophyIcon, UsersIcon, LayersIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"

const links = [
  { href: "/", label: "Leaderboard", icon: TrophyIcon, exact: true },
  { href: "/players", label: "Players", icon: UsersIcon, exact: false },
  { href: "/games", label: "Games", icon: LayersIcon, exact: false },
  { href: "/games/new", label: "New Game", icon: PlusIcon, exact: true },
]

export function SiteNav() {
  const pathname = usePathname()

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-4xl items-center gap-2 px-4">
        <Link href="/" className="mr-1 flex items-center gap-2 font-semibold">
          <SpadeIcon className="size-5 text-primary" />
          <span className="hidden sm:inline">Poker Leaderboard</span>
        </Link>
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {links.map(({ href, label, icon: Icon, exact }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                isActive(href, exact)
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  )
}
