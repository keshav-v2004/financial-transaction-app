import { TransactionsTable } from "@/components/transactions-table"
import { TransactionsImportExport } from "@/components/transactions-import-export"

export default function TransactionsPage() {
  return (
    <main className="mx-auto max-w-screen-2xl px-3 py-4 md:px-6">
      <h1 className="text-balance text-2xl font-semibold tracking-tight">Transactions</h1>
      <p className="text-muted-foreground mt-1">
        Import from CSV or XLSX and export CSV, XLSX, or PDF. Manage and categorize your transactions below.
      </p>
      <section className="mt-4">
        <TransactionsImportExport />
      </section>
      <section className="mt-6">
        <TransactionsTable />
      </section>
    </main>
  )
}
