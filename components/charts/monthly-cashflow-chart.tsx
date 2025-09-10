"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts"

type Summary = {
  months: { month: string; income: number; expense: number; net: number }[]
  totals: { income: number; expense: number; net: number }
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function MonthlyCashflowChart() {
  const { data, error, isLoading } = useSWR<Summary>("/api/analytics/summary", fetcher)
  const [series, setSeries] = useState<Summary["months"]>([])

  useEffect(() => {
    if (data?.months) setSeries(data.months)
  }, [data])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-pretty">Monthly Cashflow</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        {error ? (
          <div className="text-sm text-destructive">Failed to load analytics</div>
        ) : isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <defs>
                <linearGradient id="inc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="net" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="income" stroke="#0ea5e9" fill="url(#inc)" name="Income" />
              <Area type="monotone" dataKey="expense" stroke="#ef4444" fill="url(#exp)" name="Expense" />
              <Area type="monotone" dataKey="net" stroke="#10b981" fill="url(#net)" name="Net" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
