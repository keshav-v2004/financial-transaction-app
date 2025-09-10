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

async function ensureDefaultAccountId(supabase: ReturnType<typeof createServerClient>) {
  // Attempt server fetch to existing helper; fall back to direct query
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL
    if (base) {
      const res = await fetch(`${base}/api/accounts/ensure-default`, { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        return data.account?.id as string | undefined
      }
    }
  } catch {}
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  const { data: account } = await supabase.from("accounts").select("id").eq("owner_id", user.id).limit(1).maybeSingle()
  return account?.id
}

export async function GET() {
  const supabase = await getClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const accountId = await ensureDefaultAccountId(supabase)
  if (!accountId) return NextResponse.json({ error: "No account found" }, { status: 400 })

  const { data, error } = await supabase
    .from("transactions")
    .select("id, amount, occurred_at, description, status, category:categories(id, name, kind), created_at")
    .eq("account_id", accountId)
    .order("occurred_at", { ascending: false })
    .limit(250)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const {
    amount,
    occurred_at,
    description,
    category_id,
    status = "posted",
    direction,
  } = body as {
    amount?: number
    occurred_at?: string
    description?: string
    category_id?: string | null
    status?: string
    direction?: "income" | "expense"
  }

  if (typeof amount !== "number" || !occurred_at) {
    return NextResponse.json({ error: "amount (number) and occurred_at (ISO) are required" }, { status: 400 })
  }

  const supabase = await getClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const accountId = await ensureDefaultAccountId(supabase)
  if (!accountId) return NextResponse.json({ error: "No account found" }, { status: 400 })

  // Normalize sign by direction: positive income, negative expense
  let normalized = amount
  if (direction === "expense" && amount > 0) normalized = -amount
  if (direction === "income" && amount < 0) normalized = Math.abs(amount)

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      account_id: accountId,
      created_by: user.id,
      category_id: category_id || null,
      amount: normalized,
      occurred_at,
      description: description || null,
      status,
    })
    .select("id, amount, occurred_at, description, status, category_id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
