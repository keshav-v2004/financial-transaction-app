"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react"

export function SummaryCards() {
  // placeholder amounts; will be replaced by live data later
  const data = [
    {
      title: "Current Balance",
      value: "$12,480.22",
      icon: Wallet,
      tone: "neutral" as const,
      subLabel: "Across all accounts",
    },
    {
      title: "Income (30d)",
      value: "$8,250.00",
      icon: ArrowUpRight,
      tone: "positive" as const,
      subLabel: "vs last 30d +3.1%",
    },
    {
      title: "Expenses (30d)",
      value: "$5,140.87",
      icon: ArrowDownRight,
      tone: "attention" as const,
      subLabel: "vs last 30d -1.4%",
    },
  ]

  return (
    <section aria-labelledby="summary-title" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <h2 id="summary-title" className="sr-only">
        Financial summary
      </h2>
      {data.map((item) => {
        const Icon = item.icon
        return (
          <Card key={item.title} className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{item.title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono tracking-tight">{item.value}</div>
              <p
                className={
                  item.tone === "positive"
                    ? "text-sm text-emerald-600 dark:text-emerald-400"
                    : item.tone === "attention"
                      ? "text-sm text-blue-600 dark:text-blue-400"
                      : "text-sm text-muted-foreground"
                }
              >
                {item.subLabel}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </section>
  )
}
