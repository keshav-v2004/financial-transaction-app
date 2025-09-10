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

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = await getClient()
  const body = await req.json().catch(() => ({}))
  const role = body?.role
  if (!["owner", "admin", "member"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }
  const { error } = await supabase.from("account_members").update({ role }).eq("id", params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await getClient()
  const { error } = await supabase.from("account_members").delete().eq("id", params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
