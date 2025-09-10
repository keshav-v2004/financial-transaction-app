"use client"

import type React from "react"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function EmailCodePage() {
  const [email, setEmail] = useState("")
  const [token, setToken] = useState("")
  const [sent, setSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    const supabase = createClient()
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      })
      if (error) throw error
      setSent(true)
    } catch (err: any) {
      setError(err?.message ?? "Failed to send code")
    } finally {
      setIsLoading(false)
    }
  }

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    const supabase = createClient()
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      })
      if (error) throw error
      router.push("/")
    } catch (err: any) {
      setError(err?.message ?? "Failed to verify code")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Email code</CardTitle>
            <CardDescription>
              {sent ? "Enter the code we sent to your email" : "We'll send a one-time code to your email"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!sent ? (
              <form onSubmit={requestCode} className="flex flex-col gap-6">
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
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Sending..." : "Send code"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Tip: Your Supabase email template must include {`{{ .Token }}`} to receive a code instead of a magic
                  link.
                </p>
                <div className="text-center text-sm">
                  <Link href="/auth/login" className="underline underline-offset-4">
                    Use password instead
                  </Link>
                </div>
              </form>
            ) : (
              <form onSubmit={verifyCode} className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="token">6-digit code</Label>
                  <Input
                    id="token"
                    inputMode="numeric"
                    pattern="\d*"
                    placeholder="123456"
                    required
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Verifying..." : "Verify"}
                </Button>
                <div className="text-center text-sm">
                  <button type="button" className="underline underline-offset-4" onClick={() => setSent(false)}>
                    Resend or change email
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
