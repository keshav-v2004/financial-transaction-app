import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    },
  )

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ensure a profile row exists
  await supabase
    .from("profiles")
    .upsert(
      { id: user.id, email: user.email ?? null, full_name: user.user_metadata?.full_name ?? null },
      { onConflict: "id" },
    )

  // find an account owned by this user
  const { data: existingAcc, error: accErr } = await supabase
    .from("accounts")
    .select("id, name, currency")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle()

  if (accErr) {
    return NextResponse.json({ error: accErr.message }, { status: 400 })
  }

  if (existingAcc) {
    return NextResponse.json({ account: existingAcc })
  }

  // create default account and add membership (owner)
  const { data: insertedAcc, error: insertErr } = await supabase
    .from("accounts")
    .insert({ owner_id: user.id, name: "Personal", type: "checking", currency: "USD" })
    .select("id, name, currency")
    .single()

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 400 })
  }

  // add owner membership row
  await supabase.from("account_members").insert({ account_id: insertedAcc.id, user_id: user.id, role: "owner" })

  return NextResponse.json({ account: insertedAcc })
}
