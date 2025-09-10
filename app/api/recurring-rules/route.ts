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

async function getDefaultAccountId(supabase: ReturnType<typeof createServerClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  const { data: account } = await supabase.from("accounts").select("id").eq("owner_id", user.id).limit(1).maybeSingle()
  return account?.id as string | undefined
}

function clampDay(year: number, monthIndexZeroBased: number, day: number) {
  // monthIndexZeroBased: 0..11
  const lastDay = new Date(year, monthIndexZeroBased + 1, 0).getDate()
  return Math.min(Math.max(day, 1), lastDay)
}

function computeInitialNextRun(opts: {
  cadence: "monthly" | "weekly" | "biweekly" | "custom"
  start_date: string
  day_of_month?: number | null
  weekday?: number | null
}) {
  const today = new Date()
  const start = new Date(opts.start_date)
  if (opts.cadence === "monthly") {
    const dom = opts.day_of_month ?? start.getDate()
    const y = start.getFullYear()
    const m = start.getMonth()
    const day = clampDay(y, m, dom)
    const candidate = new Date(Date.UTC(y, m, day))
    return candidate.toISOString().slice(0, 10)
  }
  if (opts.cadence === "weekly") {
    const weekday = typeof opts.weekday === "number" ? opts.weekday : start.getUTCDay()
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))
    while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().slice(0, 10)
  }
  if (opts.cadence === "biweekly") {
    return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))
      .toISOString()
      .slice(0, 10)
  }
  // custom: use start_date as next_run_date; user can manage manually
  return start.toISOString().slice(0, 10)
}

export async function GET() {
  const supabase = await getClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const accountId = await getDefaultAccountId(supabase)
  if (!accountId) return NextResponse.json({ error: "No account found" }, { status: 400 })

  const { data, error } = await supabase
    .from("recurring_rules")
    .select(
      "id, account_id, category_id, amount, cadence, day_of_month, weekday, start_date, next_run_date, active, description, created_at",
    )
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    amount?: number
    direction?: "income" | "expense"
    cadence?: "monthly" | "weekly" | "biweekly" | "custom"
    day_of_month?: number | null
    weekday?: number | null
    start_date?: string
    category_id?: string | null
    description?: string | null
    active?: boolean
  }

  const amount = typeof body.amount === "number" ? body.amount : undefined
  const direction = body.direction ?? "expense"
  const cadence = (body.cadence as any) ?? "monthly"
  const start_date = body.start_date ?? new Date().toISOString().slice(0, 10)

  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return NextResponse.json({ error: "amount is required" }, { status: 400 })
  }

  const supabase = await getClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const accountId = await getDefaultAccountId(supabase)
  if (!accountId) return NextResponse.json({ error: "No account found" }, { status: 400 })

  const signedAmount = direction === "expense" ? -Math.abs(amount) : Math.abs(amount)
  const next_run_date = computeInitialNextRun({
    cadence,
    start_date,
    day_of_month: body.day_of_month ?? null,
    weekday: typeof body.weekday === "number" ? body.weekday : null,
  })

  const insert = {
    account_id: accountId,
    category_id: body.category_id ?? null,
    amount: signedAmount,
    cadence,
    day_of_month: body.day_of_month ?? null,
    weekday: typeof body.weekday === "number" ? body.weekday : null,
    start_date,
    next_run_date,
    active: body.active ?? true,
    description: body.description ?? null,
    created_by: user.id,
  }

  const { data, error } = await supabase
    .from("recurring_rules")
    .insert(insert)
    .select("id, amount, cadence, day_of_month, weekday, start_date, next_run_date, active, description, category_id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
