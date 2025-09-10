import { DesktopSidebar } from "@/components/app-sidebar"
import { TopNav } from "@/components/top-nav"
import { SummaryCards } from "@/components/summary-cards"
import { Card, CardContent } from "@/components/ui/card"

export default function HomePage() {
  return (
    <div className="min-h-dvh">
      <TopNav />
      <div className="mx-auto grid max-w-screen-2xl grid-cols-1 md:grid-cols-[16rem_1fr] lg:grid-cols-[18rem_1fr]">
        {/* Sidebar */}
        <DesktopSidebar />

        {/* Main content */}
        <main className="px-3 py-4 md:px-6">
          <div className="mb-4">
            <h1 className="text-balance text-2xl font-semibold tracking-tight">Overview</h1>
            <p className="text-muted-foreground">Welcome back. Here’s what’s happening with your money.</p>
          </div>

          <SummaryCards />

          <section aria-labelledby="recent-activity" className="mt-6">
            <h2 id="recent-activity" className="mb-2 text-lg font-semibold">
              Recent activity
            </h2>
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                No transactions yet. Import a bank CSV/XLSX to get started.
              </CardContent>
            </Card>
          </section>
        </main>
      </div>
    </div>
  )
}
