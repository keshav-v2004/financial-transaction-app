import { RecurringRulesManager } from "@/components/recurring-rules-manager"

export default function RecurringPage() {
  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4 text-pretty">Recurring Transactions</h1>
      <RecurringRulesManager />
    </main>
  )
}
