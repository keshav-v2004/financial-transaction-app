import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
// NOTE: Next.js infers modules; SheetJS is commonly available as 'xlsx'
import * as XLSX from "xlsx"

export async function GET() {
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

  // RLS should scope to the user via membership policies
  const { data, error } = await supabase
    .from("transactions")
    .select("id, occurred_at, amount_cents, direction, category_id, description")
    .order("occurred_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Prepare rows for XLSX
  const rows = (data ?? []).map((t) => ({
    id: t.id,
    occurred_at: t.occurred_at,
    amount: (t.amount_cents ?? 0) / 100,
    direction: t.direction,
    category_id: t.category_id ?? "",
    description: t.description ?? "",
  }))

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions")

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer
  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="transactions.xlsx"`,
      "Cache-Control": "no-store",
    },
  })
}
