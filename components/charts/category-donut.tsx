"use client"

import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"

type Summary = {
  categoryBreakdown: { name: string; amount: number }[]
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

// 5-color palette: primary blue, emerald accent, and 3 neutrals variants for consistency
const COLORS = ["#0ea5e9", "#10b981", "#111827", "#6b7280", "#374151"]

export function CategoryDonut() {
  const { data, error, isLoading } = useSWR<Summary>("/api/analytics/summary", fetcher)
  const rows = data?.categoryBreakdown ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-pretty">Top Spending Categories (This Month)</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        {error ? (
          <div className="text-sm text-destructive">Failed to load breakdown</div>
        ) : isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">No expenses this month</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={rows} dataKey="amount" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                {rows.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
