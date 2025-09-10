import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import * as XLSX from "xlsx"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (key) => cookieStore.get(key)?.value } },
  )

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: "array" })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" }) as any[]

  // Expected headers: occurred_at, amount, direction, category(optional), description(optional)
  // Fallbacks handled below.
  const rows = json.map((r) => ({
    occurred_at: r.occurred_at || r.date || r.occurredAt || null,
    amount: Number(r.amount ?? r.amount_cents ?? 0),
    direction: String(r.direction || "").toLowerCase() === "income" ? "income" : "expense",
    category: r.category ?? "",
    description: r.description ?? "",
  }))

  // ensure default account exists; relies on API you added earlier if present
  // If not present, silently continue; RLS will still scope user-owned rows.
  try {
    await fetch("/api/accounts/ensure-default", { method: "POST" })
  } catch (_) {}

  // Upsert categories by name if provided, then insert transactions.
  for (const r of rows) {
    let category_id: string | null = null
    if (r.category) {
      const { data: cat, error: catErr } = await supabase
        .from("categories")
        .select("id")
        .ilike("name", r.category)
        .limit(1)
        .maybeSingle()

      if (catErr) {
        return NextResponse.json({ error: catErr.message }, { status: 500 })
      }

      if (cat) {
        category_id = cat.id
      } else {
        const { data: newCat, error: newCatErr } = await supabase
          .from("categories")
          .insert({ name: r.category })
          .select("id")
          .single()
        if (newCatErr) {
          return NextResponse.json({ error: newCatErr.message }, { status: 500 })
        }
        category_id = newCat.id
      }
    }

    const amount_cents = Math.round(Math.abs(r.amount) * 100) * (r.direction === "income" ? 1 : -1)
    const { error: insErr } = await supabase.from("transactions").insert({
      occurred_at: r.occurred_at ? new Date(r.occurred_at).toISOString() : new Date().toISOString(),
      amount_cents,
      direction: r.direction,
      category_id,
      description: r.description || null,
    })
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
