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

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const supabase = await getClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as {
    amount?: number
    direction?: "income" | "expense"
    cadence?: "monthly" | "weekly" | "biweekly" | "custom"
    day_of_month?: number | null
    weekday?: number | null
    start_date?: string
    next_run_date?: string | null
    category_id?: string | null
    description?: string | null
    active?: boolean
  }

  const update: Record<string, any> = {}
  if (typeof body.amount === "number")
    update.amount = body.direction === "income" ? Math.abs(body.amount) : -Math.abs(body.amount)
  if (typeof body.cadence === "string") update.cadence = body.cadence
  if (typeof body.day_of_month !== "undefined") update.day_of_month = body.day_of_month
  if (typeof body.weekday !== "undefined") update.weekday = body.weekday
  if (typeof body.start_date === "string") update.start_date = body.start_date
  if (typeof body.next_run_date !== "undefined") update.next_run_date = body.next_run_date
  if (typeof body.category_id !== "undefined") update.category_id = body.category_id
  if (typeof body.description !== "undefined") update.description = body.description
  if (typeof body.active === "boolean") update.active = body.active

  const { data, error } = await supabase
    .from("recurring_rules")
    .update(update)
    .eq("id", params.id)
    .select("id, amount, cadence, day_of_month, weekday, start_date, next_run_date, active, description, category_id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await getClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { error } = await supabase.from("recurring_rules").delete().eq("id", params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
