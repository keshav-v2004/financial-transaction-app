"use client"

import useSWR from "swr"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function useCategories() {
  const { data, isLoading } = useSWR<{ data?: any[]; error?: string }>("/api/categories", fetcher)
  return {
    categories: data?.data || [],
    loading: isLoading,
  }
}

function currency(n: number) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n)
  } catch {
    return n.toFixed(2)
  }
}

export function TransactionsTable() {
  const { categories } = useCategories()
  const { data, mutate, isLoading } = useSWR<{ data?: any[]; error?: string }>("/api/transactions", fetcher)

  const [amount, setAmount] = useState<string>("")
  const [direction, setDirection] = useState<"expense" | "income">("expense")
  const [occuredAt, setOccuredAt] = useState<string>("")
  const [description, setDescription] = useState<string>("")
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined)

  const rows = useMemo(() => data?.data || [], [data])

  async function addTransaction() {
    const val = Number.parseFloat(amount)
    if (Number.isNaN(val) || !occuredAt) return

    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: val,
        occurred_at: new Date(occuredAt).toISOString(),
        description: description || undefined,
        category_id: categoryId || null,
        direction,
      }),
    })

    if (res.ok) {
      setAmount("")
      setOccuredAt("")
      setDescription("")
      setCategoryId(undefined)
      await mutate()
    } else {
      const j = await res.json().catch(() => ({}))
      alert(j.error || "Failed to add transaction")
    }
  }

  async function deleteTransaction(id: string) {
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" })
    if (res.ok) await mutate()
    else {
      const j = await res.json().catch(() => ({}))
      alert(j.error || "Failed to delete transaction")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-pretty">Transactions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Create form */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <Input
            inputMode="decimal"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Amount"
          />

          <Select value={direction} onValueChange={(v) => setDirection(v as any)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="income">Income</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="datetime-local"
            value={occuredAt}
            onChange={(e) => setOccuredAt(e.target.value)}
            aria-label="Occurred at"
          />

          <Select value={categoryId} onValueChange={(v) => setCategoryId(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Category (optional)" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-label="Description"
          />

          <Button onClick={addTransaction} className="w-full">
            Add
          </Button>
        </div>

        {/* Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Description</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3 text-right">Amount</th>
                <th className="py-2 pr-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="py-2 text-muted-foreground" colSpan={5}>
                    Loading...
                  </td>
                </tr>
              )}
              {rows.map((t) => (
                <tr key={t.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-3">{new Date(t.occurred_at).toLocaleString()}</td>
                  <td className="py-2 pr-3">{t.description || "-"}</td>
                  <td className="py-2 pr-3">{t.category?.name || "-"}</td>
                  <td
                    className={cn(
                      "py-2 pr-3 text-right font-medium",
                      t.amount < 0 ? "text-red-600" : "text-emerald-600",
                    )}
                  >
                    {currency(t.amount)}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <Button variant="destructive" size="sm" onClick={() => deleteTransaction(t.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td className="py-2 text-muted-foreground" colSpan={5}>
                    No transactions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
