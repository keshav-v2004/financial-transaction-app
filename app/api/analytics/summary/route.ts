import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

type TxRow = {
  occurred_at: string
  amount: number | null
  amount_cents: number | null
  direction: "income" | "expense" | null
  category?: { name?: string | null } | null
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function addMonths(d: Date, m: number) {
  const n = new Date(d)
  n.setMonth(n.getMonth() + m)
  return n
}
function fmtMonthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

async function getClient() {
  const cookieStore = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
      },
    },
  })
}

export async function GET() {
  const supabase = await getClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Choose default account by owner_id to match existing patterns in CSV routes
  const { data: account } = await supabase.from("accounts").select("id").eq("owner_id", user.id).limit(1).maybeSingle()
  const accountId = account?.id as string | undefined
  if (!accountId) return NextResponse.json({ error: "No account found" }, { status: 400 })

  // Time window: last 12 months including current
  const end = new Date()
  const start = addMonths(startOfMonth(end), -11)

  const { data, error } = await supabase
    .from("transactions")
    .select("occurred_at, amount, amount_cents, direction, category:categories(name)")
    .eq("account_id", accountId)
    .gte("occurred_at", start.toISOString())
    .lte("occurred_at", end.toISOString())
    .order("occurred_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const monthly: Record<string, { income: number; expense: number; net: number }> = {}
  const byCategoryThisMonth: Record<string, { amount: number }> = {}

  const thisMonthStart = startOfMonth(end)
  const thisMonthKey = fmtMonthKey(thisMonthStart)

  for (const row of (data ?? []) as TxRow[]) {
    const occurred = new Date(row.occurred_at)
    const monthKey = fmtMonthKey(new Date(occurred.getFullYear(), occurred.getMonth(), 1))

    const hasCents = typeof row.amount_cents === "number" && row.amount_cents !== null
    const val = hasCents ? (row.amount_cents as number) / 100 : Number(row.amount ?? 0)

    let kind: "income" | "expense"
    if (row.direction === "income" || row.direction === "expense") {
      kind = row.direction
    } else {
      // legacy: infer from sign
      kind = val >= 0 ? "income" : "expense"
    }
    const absVal = Math.abs(val)

    if (!monthly[monthKey]) {
      monthly[monthKey] = { income: 0, expense: 0, net: 0 }
    }
    if (kind === "income") {
      monthly[monthKey].income += absVal
      monthly[monthKey].net += absVal
    } else {
      monthly[monthKey].expense += absVal
      monthly[monthKey].net -= absVal
    }

    // Category breakdown for current month only (expenses by default)
    const isThisMonth = monthKey === thisMonthKey
    if (isThisMonth && kind === "expense") {
      const name = row.category?.name?.trim() || "Uncategorized"
      if (!byCategoryThisMonth[name]) byCategoryThisMonth[name] = { amount: 0 }
      byCategoryThisMonth[name].amount += absVal
    }
  }

  // Normalize monthly into ordered array of last 12 months
  const months: { month: string; income: number; expense: number; net: number }[] = []
  for (let i = 0; i < 12; i++) {
    const d = addMonths(start, i)
    const key = fmtMonthKey(d)
    const m = monthly[key] ?? { income: 0, expense: 0, net: 0 }
    months.push({ month: key, ...m })
  }

  // Category breakdown array
  const categoryBreakdown = Object.entries(byCategoryThisMonth)
    .map(([name, v]) => ({ name, amount: v.amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 12)

  // Totals
  const totals = months.reduce(
    (acc, m) => {
      acc.income += m.income
      acc.expense += m.expense
      acc.net += m.net
      return acc
    },
    { income: 0, expense: 0, net: 0 },
  )

  return NextResponse.json({
    months,
    categoryBreakdown,
    totals,
    asOf: new Date().toISOString(),
  })
}
