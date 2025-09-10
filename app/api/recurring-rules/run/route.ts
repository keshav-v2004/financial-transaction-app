import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

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

function nextDateForMonthly(current: Date, dayOfMonth?: number | null) {
  const y = current.getUTCFullYear()
  const m = current.getUTCMonth()
  const nextMonth = new Date(Date.UTC(y, m + 1, 1))
  const lastDay = new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0)).getUTCDate()
  const d = Math.min(Math.max(dayOfMonth ?? current.getUTCDate(), 1), lastDay)
  return new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), d))
}
function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

export async function POST() {
  const supabase = await getClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Determine account
  const { data: account } = await supabase.from("accounts").select("id").eq("owner_id", user.id).limit(1).maybeSingle()
  const accountId = account?.id as string | undefined
  if (!accountId) return NextResponse.json({ error: "No account found" }, { status: 400 })

  const todayStr = new Date().toISOString().slice(0, 10)

  // Fetch due rules
  const { data: rules, error: rulesErr } = await supabase
    .from("recurring_rules")
    .select("id, amount, category_id, cadence, day_of_month, weekday, next_run_date, description")
    .eq("account_id", accountId)
    .eq("active", true)
    .lte("next_run_date", todayStr)

  if (rulesErr) return NextResponse.json({ error: rulesErr.message }, { status: 400 })

  let created = 0
  for (const r of rules || []) {
    // Create transaction
    const occurredAt = new Date().toISOString()
    const { error: insErr } = await supabase.from("transactions").insert({
      account_id: accountId,
      created_by: user.id,
      category_id: r.category_id ?? null,
      amount: r.amount,
      occurred_at: occurredAt,
      description: r.description ?? null,
      status: "posted",
    })
    if (insErr) continue
    created++

    // Advance next_run_date
    let nextDate: Date
    const current = new Date(r.next_run_date || todayStr + "T00:00:00Z")
    if (r.cadence === "monthly") {
      nextDate = nextDateForMonthly(current, r.day_of_month ?? undefined)
    } else if (r.cadence === "weekly") {
      nextDate = addDays(current, 7)
    } else if (r.cadence === "biweekly") {
      nextDate = addDays(current, 14)
    } else {
      // custom: leave as-is; user will update manually
      nextDate = current
    }
    await supabase
      .from("recurring_rules")
      .update({ next_run_date: nextDate.toISOString().slice(0, 10) })
      .eq("id", r.id)
  }

  return NextResponse.json({ created })
}
