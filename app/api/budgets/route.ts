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

// GET: list budgets (for default account/owner)
export async function GET() {
  const supabase = await getClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: account } = await supabase.from("accounts").select("id").eq("owner_id", user.id).limit(1).maybeSingle()
  if (!account?.id) return NextResponse.json({ budgets: [] })

  const { data, error } = await supabase
    .from("budgets")
    .select("id, name, monthly_limit_cents, category_id, created_at, updated_at, category:categories(name)")
    .eq("account_id", account.id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ budgets: data ?? [] })
}

// POST: create budget
export async function POST(req: Request) {
  const supabase = await getClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, monthly_limit_cents, category_id } = await req.json().catch(() => ({}))
  if (!name || typeof monthly_limit_cents !== "number") {
    return NextResponse.json({ error: "name and monthly_limit_cents required" }, { status: 400 })
  }

  const { data: account } = await supabase.from("accounts").select("id").eq("owner_id", user.id).limit(1).maybeSingle()
  if (!account?.id) return NextResponse.json({ error: "No account found" }, { status: 400 })

  const { data, error } = await supabase
    .from("budgets")
    .insert({
      account_id: account.id,
      name,
      monthly_limit_cents,
      category_id: category_id || null,
      created_by: user.id,
    })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ id: data.id })
}
