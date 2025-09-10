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

  const body = await req.json().catch(() => ({}))
  const { amount, occurred_at, description, category_id, status } = body as {
    amount?: number
    occurred_at?: string
    description?: string
    category_id?: string | null
    status?: string
  }

  const update: Record<string, any> = {}
  if (typeof amount === "number") update.amount = amount
  if (occurred_at) update.occurred_at = occurred_at
  if (typeof description === "string") update.description = description
  if (typeof category_id !== "undefined") update.category_id = category_id
  if (typeof status === "string") update.status = status

  const { data, error } = await supabase
    .from("transactions")
    .update(update)
    .eq("id", params.id)
    .select("id, amount, occurred_at, description, status, category_id")
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

  const { error } = await supabase.from("transactions").delete().eq("id", params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
