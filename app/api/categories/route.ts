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

// Helper: ensure default account, return id
async function ensureDefaultAccountId(supabase: ReturnType<typeof createServerClient>) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/accounts/ensure-default`, {
    // In Next.js, absolute fetch may not include cookies; fallback to server call:
    cache: "no-store",
  }).catch(() => null)

  if (res?.ok) {
    const data = await res.json()
    return data.account?.id as string
  }

  // Fallback: query directly (owner account)
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
    .from("categories")
    .select("id, name, kind, color, created_at")
    .eq("account_id", accountId)
    .order("name", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { name, kind = "expense", color } = body as { name?: string; kind?: string; color?: string }

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  const supabase = await getClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const accountId = await ensureDefaultAccountId(supabase)
  if (!accountId) return NextResponse.json({ error: "No account found" }, { status: 400 })

  const { data, error } = await supabase
    .from("categories")
    .insert({ account_id: accountId, name, kind, color })
    .select("id, name, kind, color")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
