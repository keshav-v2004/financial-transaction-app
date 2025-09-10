import { MonthlyCashflowChart } from "@/components/charts/monthly-cashflow-chart"
import { CategoryDonut } from "@/components/charts/category-donut"

export default function ReportsPage() {
  return (
    <main className="mx-auto max-w-screen-2xl px-3 py-4 md:px-6">
      <h1 className="text-balance text-2xl font-semibold tracking-tight">Reports</h1>
      <p className="text-muted-foreground mt-1">
        Analyze trends over time with income/expense breakdowns and category insights.
      </p>

      <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <MonthlyCashflowChart />
        <CategoryDonut />
      </section>
      {/* end charts */}
    </main>
  )
}
