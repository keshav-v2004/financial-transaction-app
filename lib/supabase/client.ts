import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    "https://aczxaztxntruoiukzana.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjenhhenR4bnRydW9pdWt6YW5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MDEyODEsImV4cCI6MjA3MjQ3NzI4MX0.afuPn1ckZffWUkCjb_wJgOQ4Itzkzus88bz2eRPVFh8",
  )
}
