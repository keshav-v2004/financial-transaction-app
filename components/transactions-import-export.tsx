"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function TransactionsImportExport() {
  const inputRef = useRef<HTMLInputElement>(null) // CSV
  const xlsxInputRef = useRef<HTMLInputElement>(null) // XLSX
  const [busy, setBusy] = useState(false) // CSV busy
  const [busyXlsx, setBusyXlsx] = useState(false) // XLSX busy

  async function onImport() {
    const file = inputRef.current?.files?.[0]
    if (!file) return
    const form = new FormData()
    form.append("file", file)
    setBusy(true)
    try {
      const res = await fetch("/api/transactions/import", { method: "POST", body: form })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(j.error || "Import failed")
      } else {
        alert(`Imported ${j.imported ?? 0} transactions`)
        window.location.reload()
      }
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function onImportXlsx() {
    const file = xlsxInputRef.current?.files?.[0]
    if (!file) return
    const form = new FormData()
    form.append("file", file)
    setBusyXlsx(true)
    try {
      const res = await fetch("/api/transactions/import/xlsx", { method: "POST", body: form })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(j.error || "Import failed")
      } else {
        // XLSX route returns { ok: true } in our implementation
        alert("Import complete")
        window.location.reload()
      }
    } finally {
      setBusyXlsx(false)
      if (xlsxInputRef.current) xlsxInputRef.current.value = ""
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-pretty">Import / Export</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/api/transactions/export"
              className="underline underline-offset-2 text-primary"
              download="transactions.csv"
            >
              Download CSV
            </a>
            <a
              href="/api/transactions/export/xlsx"
              className="underline underline-offset-2 text-primary"
              download="transactions.xlsx"
            >
              Download XLSX
            </a>
            <a
              href="/api/transactions/export/pdf"
              className="underline underline-offset-2 text-primary"
              download="transactions.pdf"
            >
              Download PDF
            </a>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
          <input type="file" accept=".csv,text/csv" ref={inputRef} aria-label="CSV File" />
          <Button onClick={onImport} disabled={busy}>
            {busy ? "Importing..." : "Import CSV"}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          CSV columns: occurred_at (ISO), description, category, amount, status. You can export first to see the format.
        </p>

        <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ref={xlsxInputRef}
            aria-label="XLSX File"
          />
          <Button onClick={onImportXlsx} disabled={busyXlsx}>
            {busyXlsx ? "Importing..." : "Import XLSX"}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          XLSX columns: occurred_at, amount, direction (income|expense), category (optional), description (optional).
        </p>
      </CardContent>
    </Card>
  )
}
