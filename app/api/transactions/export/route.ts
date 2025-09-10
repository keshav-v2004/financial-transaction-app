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

export async function GET() {
  const supabase = await getClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  // Determine default account (owner)
  const { data: account } = await supabase.from("accounts").select("id").eq("owner_id", user.id).limit(1).maybeSingle()
  const accountId = account?.id
  if (!accountId) return new NextResponse("No account found", { status: 400 })

  const { data, error } = await supabase
    .from("transactions")
    .select("occurred_at, description, amount, status, category:categories(name)")
    .eq("account_id", accountId)
    .order("occurred_at", { ascending: true })

  if (error) return new NextResponse(error.message, { status: 400 })

  const rows = (data || []).map((t: any) => ({
    occurred_at: t.occurred_at,
    description: t.description ?? "",
    category: t.category?.name ?? "",
    amount: t.amount,
    status: t.status ?? "posted",
  }))

  const header = ["occurred_at", "description", "category", "amount", "status"]
  const csv = [
    header.join(","),
    ...rows.map((r) =>
      [r.occurred_at, r.description.replace(/"/g, '""'), r.category.replace(/"/g, '""'), r.amount, r.status]
        .map((v) => (typeof v === "string" && v.includes(",") ? `"${v}"` : v))
        .join(","),
    ),
  ].join("\n")

  const res = new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transactions.csv"`,
      "Cache-Control": "no-store",
    },
  })
  return res
}
