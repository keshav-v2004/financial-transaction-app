"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type TotpEnrollment = {
  factorId: string
  qrCode?: string
  secret?: string
}

export default function SettingsPage() {
  const [enrolledId, setEnrolledId] = useState<string | null>(null)
  const [enroll, setEnroll] = useState<TotpEnrollment | null>(null)
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadFactors() {
    const supabase = createClient()
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) {
      setError(error.message)
      return
    }
    const totp = data?.factors?.find((f: any) => f.factor_type === "totp" && f.status === "verified")
    setEnrolledId(totp?.id ?? null)
  }

  useEffect(() => {
    loadFactors()
  }, [])

  const startEnroll = async () => {
    setLoading(true)
    setError(null)
    setMessage(null)
    const supabase = createClient()
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" as any })
      if (error) throw error
      setEnroll({
        factorId: data.id,
        qrCode: data.totp?.qr_code,
        secret: data.totp?.secret,
      })
      setMessage(
        "Scan the QR code with your authenticator app, or enter the secret manually. Then enter the 6-digit code below.",
      )
    } catch (err: any) {
      setError(err?.message ?? "Failed to start enrollment")
    } finally {
      setLoading(false)
    }
  }

  const verifyEnroll = async () => {
    if (!enroll?.factorId || !code) return
    setLoading(true)
    setError(null)
    setMessage(null)
    const supabase = createClient()
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enroll.factorId,
        code,
      } as any)
      if (error) throw error
      setMessage("TOTP successfully enabled.")
      setEnroll(null)
      setCode("")
      await loadFactors()
    } catch (err: any) {
      setError(err?.message ?? "Verification failed")
    } finally {
      setLoading(false)
    }
  }

  const disableTotp = async () => {
    if (!enrolledId) return
    setLoading(true)
    setError(null)
    setMessage(null)
    const supabase = createClient()
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: enrolledId } as any)
      if (error) throw error
      setMessage("TOTP disabled.")
      setEnrolledId(null)
    } catch (err: any) {
      setError(err?.message ?? "Failed to disable TOTP")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto max-w-screen-2xl px-3 py-4 md:px-6">
      <h1 className="text-balance text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="text-muted-foreground mt-1">Manage account, preferences, and security.</p>

      <section className="mt-6 grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Two-Factor Authentication (TOTP)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {enrolledId ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">TOTP is enabled on your account.</p>
                <Button variant="destructive" onClick={disableTotp} disabled={loading}>
                  {loading ? "Disabling..." : "Disable TOTP"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {!enroll ? (
                  <Button onClick={startEnroll} disabled={loading}>
                    {loading ? "Preparing..." : "Enable TOTP"}
                  </Button>
                ) : (
                  <div className="space-y-3">
                    {enroll.qrCode ? (
                      // qrCode may be a data URL SVG. Render safely as an image.
                      <img
                        src={enroll.qrCode || "/placeholder.svg"}
                        alt="Scan this QR with your authenticator app"
                        className="h-40 w-40"
                      />
                    ) : null}
                    {enroll.secret ? (
                      <p className="text-sm">
                        Secret: <span className="font-mono">{enroll.secret}</span>
                      </p>
                    ) : null}
                    <div className="grid gap-2 max-w-xs">
                      <Label htmlFor="code">6-digit code</Label>
                      <Input
                        id="code"
                        inputMode="numeric"
                        pattern="\d*"
                        placeholder="123456"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={verifyEnroll} disabled={loading || !code}>
                        {loading ? "Verifying..." : "Verify & Enable"}
                      </Button>
                      <Button variant="outline" onClick={() => setEnroll(null)} disabled={loading}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {message && <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}
            {error && <p className="text-sm text-red-500">{error}</p>}
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
