import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

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

  const { data, error } = await supabase
    .from("transactions")
    .select("occurred_at, amount_cents, direction, description")
    .order("occurred_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89]) // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const titleSize = 18
  const textSize = 11
  const marginX = 40
  let cursorY = 800

  page.drawText("Transactions Report", {
    x: marginX,
    y: cursorY,
    size: titleSize,
    font,
    color: rgb(0.1, 0.1, 0.12),
  })
  cursorY -= 28

  // headers
  const header = ["Date", "Amount", "Type", "Description"]
  const colWidths = [100, 100, 70, 250]
  let x = marginX
  header.forEach((h, i) => {
    page.drawText(h, { x, y: cursorY, size: textSize, font })
    x += colWidths[i]
  })
  cursorY -= 16

  const lines = Math.min(40, data?.length ?? 0)
  for (let i = 0; i < lines; i++) {
    const t = data![i]
    const date = new Date(t.occurred_at as string).toISOString().slice(0, 10)
    const amount = ((t.amount_cents ?? 0) / 100).toFixed(2)
    const dir = t.direction === "income" ? "Income" : "Expense"
    const desc = t.description ?? ""

    let x = marginX
    ;[date, amount, dir, desc].forEach((val, idx) => {
      page.drawText(String(val).slice(0, 40), { x, y: cursorY, size: textSize, font })
      x += colWidths[idx]
    })
    cursorY -= 14
    if (cursorY < 60) break
  }

  const pdfBytes = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="transactions.pdf"',
      "Cache-Control": "no-store",
    },
  })
}
