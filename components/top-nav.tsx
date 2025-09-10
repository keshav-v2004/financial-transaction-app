"use client"

import { useState } from "react"
import { ThemeToggle } from "./theme-toggle"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { DesktopSidebar, MobileSidebarButton } from "./app-sidebar"
import { UserMenu } from "@/components/user-menu"

export function TopNav() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-3 md:px-6">
        <div className="flex items-center gap-2">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <MobileSidebarButton onClick={() => setOpen(true)} />
            </SheetTrigger>
            <SheetContent side="left" className="p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <DesktopSidebar />
            </SheetContent>
          </Sheet>
          <span className="font-semibold md:hidden">FinTrack</span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
            Search
          </Button>
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
