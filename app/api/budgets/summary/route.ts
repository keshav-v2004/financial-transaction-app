import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function endOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
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

// Returns budgets + spent_this_month_cents per budget (category-specific or overall)
export async function GET() {
  const supabase = await getClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: account } = await supabase.from("accounts").select("id").eq("owner_id", user.id).limit(1).maybeSingle()
  const accountId = account?.id as string | undefined
  if (!accountId) return NextResponse.json({ items: [] })

  const { data: budgets, error: bErr } = await supabase
    .from("budgets")
    .select("id, name, monthly_limit_cents, category_id, category:categories(name)")
    .eq("account_id", accountId)
    .order("name", { ascending: true })

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 400 })

  // Fetch this month's transactions (single query) to compute spent
  const from = startOfMonth().toISOString()
  const to = endOfMonth().toISOString()
  const { data: txs, error: tErr } = await supabase
    .from("transactions")
    .select("amount, amount_cents, direction, category_id, occurred_at")
    .eq("account_id", accountId)
    .gte("occurred_at", from)
    .lte("occurred_at", to)

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 400 })

  // Build sums
  const byCategory: Record<string, number> = {}
  let totalExpenses = 0
  for (const t of txs ?? []) {
    const cents = typeof t.amount_cents === "number" ? t.amount_cents : Math.round((t.amount ?? 0) * 100)
    const isExpense = t.direction ? t.direction === "expense" : cents < 0
    const abs = Math.abs(cents)
    if (isExpense) {
      totalExpenses += abs
      if (t.category_id) {
        byCategory[t.category_id] = (byCategory[t.category_id] ?? 0) + abs
      }
    }
  }

  const items = (budgets ?? []).map((b: any) => {
    const spent = b.category_id ? (byCategory[b.category_id] ?? 0) : totalExpenses
    const limit = b.monthly_limit_cents
    const remaining = Math.max(0, limit - spent)
    const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0
    return {
      id: b.id,
      name: b.name,
      category_id: b.category_id,
      category_name: b.category?.name ?? null,
      monthly_limit_cents: limit,
      spent_cents: spent,
      remaining_cents: remaining,
      percent: pct,
    }
  })

  return NextResponse.json({ items })
}
