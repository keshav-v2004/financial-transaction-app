import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient as createServiceClient } from "@supabase/supabase-js"

// Accept invite using service role (to read by token), but link the membership to the logged-in user
export async function POST(_req: Request, { params }: { params: { token: string } }) {
  // Get the authenticated user
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {},
      },
    },
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Service client for invite lookup + membership write
  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // Validate invite
  const { data: invite, error: invErr } = await admin
    .from("account_invites")
    .select("id, account_id, role, expires_at, accepted_at")
    .eq("token", params.token)
    .maybeSingle()

  if (invErr || !invite) return NextResponse.json({ error: "Invalid invite" }, { status: 400 })
  if (invite.accepted_at) return NextResponse.json({ error: "Invite already accepted" }, { status: 400 })
  if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: "Invite expired" }, { status: 400 })

  // Upsert membership
  const { error: memErr } = await admin
    .from("account_members")
    .upsert(
      { account_id: invite.account_id, user_id: user.id, role: invite.role },
      { onConflict: "account_id,user_id" },
    )
  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 400 })

  // Mark invite accepted
  await admin.from("account_invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id)

  return NextResponse.json({ ok: true })
}
