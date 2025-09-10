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

// List members for the owner's default account
export async function GET() {
  const supabase = await getClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: account } = await supabase.from("accounts").select("id").eq("owner_id", user.id).limit(1).maybeSingle()
  if (!account?.id) return NextResponse.json({ members: [], invites: [] })

  const { data: members, error: mErr } = await supabase
    .from("account_members")
    .select("id, user_id, role, created_at")
    .eq("account_id", account.id)
    .order("created_at", { ascending: true })

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 400 })

  const { data: invites, error: iErr } = await supabase
    .from("account_invites")
    .select("id, email, role, token, expires_at, accepted_at, created_at")
    .eq("account_id", account.id)
    .is("accepted_at", null)
    .order("created_at", { ascending: false })

  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 400 })

  return NextResponse.json({ members: members ?? [], invites: invites ?? [] })
}

// Create invite (owner/admin only via RLS)
export async function POST(req: Request) {
  const supabase = await getClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { email, role } = await req.json().catch(() => ({}))
  if (!email || !role || !["admin", "member"].includes(role)) {
    return NextResponse.json({ error: "email and role (admin|member) required" }, { status: 400 })
  }

  const { data: account } = await supabase.from("accounts").select("id").eq("owner_id", user.id).limit(1).maybeSingle()
  if (!account?.id) return NextResponse.json({ error: "No account found" }, { status: 400 })

  const token = crypto.randomUUID()
  const expires = new Date()
  expires.setDate(expires.getDate() + 7)

  const { data, error } = await supabase
    .from("account_invites")
    .insert({ account_id: account.id, email, role, token, expires_at: expires.toISOString(), created_by: user.id })
    .select("id, token, expires_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Build invite URL based on current request
  const origin = new URL(req.url).origin
  const inviteUrl = `${origin}/accept-invite?token=${data.token}`

  return NextResponse.json({ inviteUrl, expires_at: data.expires_at })
}
