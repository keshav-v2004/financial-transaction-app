"use client"

import useSWR from "swr"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type BudgetItem = {
  id: string
  name: string
  category_id: string | null
  category?: { name?: string | null } | null
  monthly_limit_cents: number
}
type SummaryItem = {
  id: string
  name: string
  category_id: string | null
  category_name: string | null
  monthly_limit_cents: number
  spent_cents: number
  remaining_cents: number
  percent: number
}

export function BudgetsManager() {
  const { data: budgetsData, mutate } = useSWR<{ budgets: BudgetItem[] }>("/api/budgets", fetcher)
  const { data: summaryData, mutate: mutateSummary } = useSWR<{ items: SummaryItem[] }>("/api/budgets/summary", fetcher)
  const { data: categories } = useSWR<{ categories: { id: string; name: string }[] }>("/api/categories?list=1", fetcher)

  const [name, setName] = useState("")
  const [limit, setLimit] = useState("")
  const [categoryId, setCategoryId] = useState<string | undefined>("all") // Updated default value
  const [saving, setSaving] = useState(false)

  async function createBudget() {
    if (!name || !limit) return
    const cents = Math.round(Number(limit) * 100)
    if (!Number.isFinite(cents) || cents < 0) return
    setSaving(true)
    try {
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, monthly_limit_cents: cents, category_id: categoryId || null }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(j.error || "Failed to create budget")
      } else {
        setName("")
        setLimit("")
        setCategoryId("all") // Reset to default value
        mutate()
        mutateSummary()
      }
    } finally {
      setSaving(false)
    }
  }

  async function removeBudget(id: string) {
    const ok = confirm("Delete this budget?")
    if (!ok) return
    const res = await fetch(`/api/budgets/${id}`, { method: "DELETE" })
    if (res.ok) {
      mutate()
      mutateSummary()
    }
  }

  const items = budgetsData?.budgets ?? []
  const summary = summaryData?.items ?? []
  const rows = items.map((b) => ({
    ...b,
    progress: summary.find((s) => s.id === b.id),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-pretty">Budgets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="budget-name">Name</Label>
            <Input id="budget-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Groceries" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="budget-amount">Monthly limit</Label>
            <Input
              id="budget-amount"
              inputMode="decimal"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="300"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Category (optional)</Label>
            <Select value={categoryId ?? "all"} onValueChange={(v) => setCategoryId(v || "all")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All expenses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All expenses</SelectItem>
                {(categories?.categories ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3">
            <Button onClick={createBudget} disabled={saving}>
              {saving ? "Saving..." : "Add Budget"}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No budgets yet. Create your first budget above.</p>
          ) : (
            rows.map((b) => {
              const p = b.progress
              const limit = b.monthly_limit_cents / 100
              const spent = (p?.spent_cents ?? 0) / 100
              const remaining = (p?.remaining_cents ?? 0) / 100
              const percent = p?.percent ?? 0
              return (
                <div key={b.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{b.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {b.category?.name ? `Category: ${b.category?.name}` : "All expenses"}
                      </div>
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => removeBudget(b.id)}>
                      Delete
                    </Button>
                  </div>
                  <div className="mt-2">
                    <Progress value={percent} />
                    <div className="mt-1 text-xs text-muted-foreground">
                      {`$${spent.toFixed(2)} / $${limit.toFixed(2)} spent (${percent}%) — remaining $${remaining.toFixed(2)}`}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}
