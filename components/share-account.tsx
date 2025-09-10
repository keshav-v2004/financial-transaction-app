"use client"

import useSWR from "swr"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function ShareAccount() {
  const { data, mutate } = useSWR<{ members: { id: string; user_id: string; role: string }[]; invites: any[] }>(
    "/api/accounts/members",
    fetcher,
  )
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"member" | "admin">("member")
  const [busy, setBusy] = useState(false)

  async function invite() {
    if (!email) return
    setBusy(true)
    try {
      const res = await fetch("/api/accounts/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(j.error || "Failed to create invite")
      } else {
        await navigator.clipboard.writeText(j.inviteUrl)
        alert("Invite link copied to clipboard")
        setEmail("")
        setRole("member")
        mutate()
      }
    } finally {
      setBusy(false)
    }
  }

  async function changeRole(id: string, newRole: string) {
    await fetch(`/api/accounts/members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    })
    mutate()
  }

  async function removeMember(id: string) {
    const ok = confirm("Remove this member?")
    if (!ok) return
    await fetch(`/api/accounts/members/${id}`, { method: "DELETE" })
    mutate()
  }

  const members = data?.members ?? []
  const invites = data?.invites ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-pretty">Sharing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Invite by email</Label>
            <Input
              id="invite-email"
              placeholder="person@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "member" | "admin")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:self-end">
            <Button onClick={invite} disabled={busy}>
              {busy ? "Creating…" : "Create Invite"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Pending invites</div>
          {invites.length === 0 ? (
            <div className="text-sm text-muted-foreground">No pending invites</div>
          ) : (
            <ul className="space-y-1">
              {invites.map((i: any) => (
                <li key={i.id} className="flex items-center justify-between rounded border p-2">
                  <div className="text-sm">
                    <div className="font-medium">{i.email}</div>
                    <div className="text-xs text-muted-foreground">
                      Role: {i.role} • Expires: {new Date(i.expires_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        const origin = window.location.origin
                        await navigator.clipboard.writeText(`${origin}/accept-invite?token=${i.token}`)
                        alert("Invite link copied")
                      }}
                    >
                      Copy Link
                    </Button>
                    {/* Optional: add delete invite endpoint later */}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Members</div>
          {members.length === 0 ? (
            <div className="text-sm text-muted-foreground">No members yet</div>
          ) : (
            <ul className="space-y-1">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between rounded border p-2">
                  <div className="text-sm">
                    <div className="font-medium">{m.user_id}</div>
                    <div className="text-xs text-muted-foreground">User ID</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={m.role} onValueChange={(v) => changeRole(m.id, v)}>
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="destructive" size="sm" onClick={() => removeMember(m.id)}>
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
