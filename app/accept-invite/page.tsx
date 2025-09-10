"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function AcceptInvitePage() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get("token") || ""
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function accept() {
    if (!token) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/accounts/invites/${encodeURIComponent(token)}/accept`, { method: "POST" })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg(j.error || "Failed to accept invite")
      } else {
        setMsg("Invite accepted! Redirecting…")
        setTimeout(() => router.push("/"), 1000)
      }
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!token) setMsg("Missing invite token")
  }, [token])

  return (
    <main className="mx-auto max-w-md px-3 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Accept Invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {msg ?? "You’ve been invited to collaborate on an account. Click below to accept."}
          </p>
          <Button onClick={accept} disabled={busy || !token}>
            {busy ? "Accepting..." : "Accept Invite"}
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
