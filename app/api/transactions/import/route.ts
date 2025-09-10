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

function parseCsv(text: string) {
  // Simple CSV parser (no advanced quoted field handling beyond commas)
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(Boolean)
  if (lines.length === 0) return { header: [], rows: [] }
  const header = lines[0].split(",").map((h) => h.trim())
  const rows = lines.slice(1).map((l) => l.split(","))
  return { header, rows }
}

export async function POST(req: Request) {
  const supabase = await getClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 })
  const file = form.get("file")
  if (!(file instanceof Blob)) return NextResponse.json({ error: "File is required" }, { status: 400 })
  const text = await file.text()

  const { header, rows } = parseCsv(text)
  const idx = {
    occurred_at: header.findIndex((h) => h.toLowerCase() === "occurred_at"),
    description: header.findIndex((h) => h.toLowerCase() === "description"),
    category: header.findIndex((h) => h.toLowerCase() === "category"),
    amount: header.findIndex((h) => h.toLowerCase() === "amount"),
    status: header.findIndex((h) => h.toLowerCase() === "status"),
  }
  if (idx.occurred_at < 0 || idx.amount < 0) {
    return NextResponse.json({ error: "CSV must include occurred_at and amount columns" }, { status: 400 })
  }

  // Determine default account
  const { data: account } = await supabase.from("accounts").select("id").eq("owner_id", user.id).limit(1).maybeSingle()
  const accountId = account?.id as string | undefined
  if (!accountId) return NextResponse.json({ error: "No account found" }, { status: 400 })

  let imported = 0

  for (const raw of rows) {
    const occurred_at = raw[idx.occurred_at]?.trim()
    const amountStr = raw[idx.amount]?.trim()
    if (!occurred_at || !amountStr) continue

    const description = idx.description >= 0 ? raw[idx.description]?.trim() || null : null
    const status = idx.status >= 0 ? raw[idx.status]?.trim() || "posted" : "posted"
    const categoryName = idx.category >= 0 ? raw[idx.category]?.trim() : ""

    const amount = Number.parseFloat(amountStr)
    if (!Number.isFinite(amount)) continue

    let category_id: string | null = null
    if (categoryName) {
      // ensure category exists (expense by default)
      const { data: cat, error: catErr } = await supabase
        .from("categories")
        .upsert({ account_id: accountId, name: categoryName, kind: "expense" }, { onConflict: "account_id,name" })
        .select("id")
        .maybeSingle()
      if (!catErr && cat) category_id = cat.id
      else {
        // try select if upsert conflict returned none
        const { data: c2 } = await supabase
          .from("categories")
          .select("id")
          .eq("account_id", accountId)
          .eq("name", categoryName)
          .maybeSingle()
        if (c2) category_id = c2.id
      }
    }

    const { error: insertErr } = await supabase.from("transactions").insert({
      account_id: accountId,
      created_by: user.id,
      category_id,
      amount,
      occurred_at: new Date(occurred_at).toISOString(),
      description,
      status,
    })
    if (!insertErr) imported++
  }

  return NextResponse.json({ imported })
}
