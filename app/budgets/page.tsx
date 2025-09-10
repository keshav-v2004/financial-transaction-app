import { BudgetsManager } from "@/components/budgets-manager"

export default function BudgetsPage() {
  return (
    <main className="mx-auto max-w-screen-2xl px-3 py-4 md:px-6">
      <h1 className="text-balance text-2xl font-semibold tracking-tight">Budgets</h1>
      <p className="text-muted-foreground mt-1">
        Create monthly budgets and track spending against targets with real-time progress tracking.
      </p>

      <section className="mt-6">
        <BudgetsManager />
      </section>
    </main>
  )
}
