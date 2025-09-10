"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, Rows3, PiggyBank, LineChart, Settings, ChevronRight } from "lucide-react"

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: Rows3 },
  { href: "/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/reports", label: "Reports", icon: LineChart },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function DesktopSidebar() {
  const pathname = usePathname()
  return (
    <aside className="hidden md:flex md:w-64 lg:w-72 shrink-0 border-r bg-card">
      <nav className="w-full p-4">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="h-8 w-8 rounded-md bg-blue-600" aria-hidden />
          <span className="text-lg font-semibold tracking-tight text-pretty">FinTrack</span>
        </div>
        <ul className="space-y-1.5">
          {nav.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "group flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4" aria-hidden />
                    {item.label}
                  </span>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity",
                      active && "opacity-100",
                    )}
                  />
                </Link>
              </li>
            )
          })}
        </ul>
        <div className="mt-8 rounded-md border bg-muted/40 p-3">
          <p className="text-sm text-muted-foreground text-pretty">
            Track spending, set budgets, and visualize your financial health.
          </p>
        </div>
      </nav>
    </aside>
  )
}

export function MobileSidebarButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" onClick={onClick} aria-label="Open menu" className="md:hidden">
      <span className="sr-only">Open menu</span>
      {/* Simple hamburger */}
      <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
        <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </Button>
  )
}
