"use client"
import useSWR from "swr"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function CategoriesManager() {
  const { data, mutate, isLoading } = useSWR<{ data?: any[]; error?: string }>("/api/categories", fetcher)
  const [name, setName] = useState("")
  const [kind, setKind] = useState<"expense" | "income" | "transfer">("expense")
  const [color, setColor] = useState<string>("")

  async function addCategory() {
    if (!name.trim()) return
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, kind, color: color || undefined }),
    })
    if (res.ok) {
      setName("")
      setColor("")
      await mutate()
    } else {
      const j = await res.json().catch(() => ({}))
      alert(j.error || "Failed to add category")
    }
  }

  async function removeCategory(id: string) {
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" })
    if (res.ok) await mutate()
    else {
      const j = await res.json().catch(() => ({}))
      alert(j.error || "Failed to delete category")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-pretty">Categories</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-2">
          <Input placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} />
          <Select value={kind} onValueChange={(v) => setKind(v as any)}>
            <SelectTrigger className="min-w-[160px]">
              <SelectValue placeholder="Kind" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Color (e.g., #22c55e)" value={color} onChange={(e) => setColor(e.target.value)} />
          <Button onClick={addCategory} className="md:self-start">
            Add
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {isLoading && <div>Loading...</div>}
          {data?.error && <div className="text-red-500">{data.error}</div>}
          {data?.data?.map((c) => (
            <div key={c.id} className={cn("flex items-center justify-between rounded border p-3")}>
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded" style={{ background: c.color || "#e5e7eb" }} aria-hidden />
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.kind}</div>
                </div>
              </div>
              <Button variant="destructive" onClick={() => removeCategory(c.id)}>
                Delete
              </Button>
            </div>
          ))}
          {!isLoading && !data?.data?.length && <div className="text-sm text-muted-foreground">No categories yet.</div>}
        </div>
      </CardContent>
    </Card>
  )
}
