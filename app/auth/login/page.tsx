"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function Page() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaCode, setMfaCode] = useState("")
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/`,
        },
      })
      if (error) {
        const msg = (error as any)?.message?.toLowerCase?.() || ""
        if (msg.includes("mfa")) {
          setMfaRequired(true)
          return
        }
        throw error
      }
      router.push("/")
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const verifyMfa = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    const supabase = createClient()
    try {
      // find a verified TOTP factor
      const { data: factorsData, error: lfErr } = await supabase.auth.mfa.listFactors()
      if (lfErr) throw lfErr
      const totp = factorsData?.factors?.find((f: any) => f.factor_type === "totp" && f.status === "verified")
      if (!totp?.id) throw new Error("No TOTP factor found on this account.")
      // challenge + verify in one step
      const { error: cvErr } = await (supabase.auth.mfa as any).challengeAndVerify({
        factorId: totp.id,
        code: mfaCode,
      })
      if (cvErr) throw cvErr
      router.push("/")
    } catch (err: any) {
      setError(err?.message ?? "MFA verification failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Login</CardTitle>
              <CardDescription>Enter your email below to login to your account</CardDescription>
            </CardHeader>
            <CardContent>
              {!mfaRequired ? (
                <form onSubmit={handleLogin}>
                  <div className="flex flex-col gap-6">
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="m@example.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? "Logging in..." : "Login"}
                    </Button>
                  </div>
                  <div className="mt-4 text-center text-sm">
                    Don&apos;t have an account?{" "}
                    <Link href="/auth/sign-up" className="underline underline-offset-4">
                      Sign up
                    </Link>
                  </div>
                  <div className="mt-2 text-center text-sm">
                    Prefer a one-time code?{" "}
                    <Link href="/auth/email-code" className="underline underline-offset-4">
                      Use email code
                    </Link>
                  </div>
                </form>
              ) : (
                <form onSubmit={verifyMfa} className="flex flex-col gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="mfa">Authenticator code</Label>
                    <Input
                      id="mfa"
                      inputMode="numeric"
                      pattern="\d*"
                      placeholder="123456"
                      required
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                    />
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Verifying..." : "Verify & Continue"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Lost access? Disable TOTP from Settings when signed in, or contact support.
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
