"use client"

import useSWR from "swr"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function useCategories() {
  const { data } = useSWR<{ data?: any[]; error?: string }>("/api/categories", fetcher)
  return data?.data || []
}

export function RecurringRulesManager() {
  const { data, mutate, isLoading } = useSWR<{ data?: any[]; error?: string }>("/api/recurring-rules", fetcher)
  const rules = useMemo(() => data?.data || [], [data])

  const categories = useCategories()

  const [amount, setAmount] = useState("")
  const [direction, setDirection] = useState<"expense" | "income">("expense")
  const [cadence, setCadence] = useState<"monthly" | "weekly" | "biweekly" | "custom">("monthly")
  const [dayOfMonth, setDayOfMonth] = useState<string>("")
  const [weekday, setWeekday] = useState<string>("")
  const [startDate, setStartDate] = useState<string>("")
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined)
  const [description, setDescription] = useState<string>("")
  const [active, setActive] = useState<boolean>(true)

  async function createRule() {
    const amt = Number.parseFloat(amount)
    if (Number.isNaN(amt)) return
    const res = await fetch("/api/recurring-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: amt,
        direction,
        cadence,
        day_of_month: dayOfMonth ? Number.parseInt(dayOfMonth) : null,
        weekday: weekday ? Number.parseInt(weekday) : null,
        start_date: startDate || undefined,
        category_id: categoryId || null,
        description: description || undefined,
        active,
      }),
    })
    if (res.ok) {
      setAmount("")
      setDirection("expense")
      setCadence("monthly")
      setDayOfMonth("")
      setWeekday("")
      setStartDate("")
      setCategoryId(undefined)
      setDescription("")
      setActive(true)
      await mutate()
    } else {
      const j = await res.json().catch(() => ({}))
      alert(j.error || "Failed to create rule")
    }
  }

  async function deleteRule(id: string) {
    const res = await fetch(`/api/recurring-rules/${id}`, { method: "DELETE" })
    if (res.ok) await mutate()
  }

  async function runNow() {
    const res = await fetch("/api/recurring-rules/run", { method: "POST" })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(j.error || "Failed to run rules")
    } else {
      alert(`Created ${j.created ?? 0} transactions`)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-pretty">Recurring Rules</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
          <Input
            inputMode="decimal"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Amount"
          />
          <Select value={direction} onValueChange={(v) => setDirection(v as any)}>
            <SelectTrigger>
              <SelectValue placeholder="Direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="income">Income</SelectItem>
            </SelectContent>
          </Select>
          <Select value={cadence} onValueChange={(v) => setCadence(v as any)}>
            <SelectTrigger>
              <SelectValue placeholder="Cadence" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="biweekly">Biweekly</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Input
            inputMode="numeric"
            placeholder="Day of month (1-31)"
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
            aria-label="Day of month"
          />
          <Input
            inputMode="numeric"
            placeholder="Weekday (0=Sun..6=Sat)"
            value={weekday}
            onChange={(e) => setWeekday(e.target.value)}
            aria-label="Weekday"
          />
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-label="Start date" />
          <Select value={categoryId} onValueChange={(v) => setCategoryId(v)}>
            <SelectTrigger>
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
            className="md:col-span-4"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-label="Description"
          />
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} id="active" />
            <label htmlFor="active" className="text-sm">
              Active
            </label>
          </div>
          <Button onClick={createRule} className="md:col-span-2">
            Create Rule
          </Button>
          <Button variant="secondary" onClick={runNow}>
            Run due rules now
          </Button>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">Description</th>
                <th className="py-2 pr-3">Cadence</th>
                <th className="py-2 pr-3">Next Run</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3 text-right">Amount</th>
                <th className="py-2 pr-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="py-2 text-muted-foreground" colSpan={6}>
                    Loading...
                  </td>
                </tr>
              )}
              {rules.map((r: any) => (
                <tr key={r.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-3">{r.description || "-"}</td>
                  <td className="py-2 pr-3">
                    {r.cadence}
                    {r.cadence === "monthly" && r.day_of_month ? ` (day ${r.day_of_month})` : null}
                    {r.cadence === "weekly" && Number.isInteger(r.weekday) ? ` (wd ${r.weekday})` : null}
                  </td>
                  <td className="py-2 pr-3">{r.next_run_date || "-"}</td>
                  <td className="py-2 pr-3">{r.category_id ? "Category" : "-"}</td>
                  <td
                    className={`py-2 pr-3 text-right font-medium ${r.amount < 0 ? "text-red-600" : "text-emerald-600"}`}
                  >
                    {new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(r.amount)}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <Button variant="destructive" size="sm" onClick={() => deleteRule(r.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
              {!isLoading && rules.length === 0 && (
                <tr>
                  <td className="py-2 text-muted-foreground" colSpan={6}>
                    No recurring rules yet.
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
