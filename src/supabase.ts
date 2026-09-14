import { createClient, type Provider } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const isSupabaseConfigured = Boolean(url && key);
export const supabase = isSupabaseConfigured
  ? createClient<Database>(url!, key!, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        persistSession: true,
      },
    })
  : null;

export type LoginProvider = Extract<Provider, "github" | "google">;

export async function signInWithProvider(provider: LoginProvider) {
  if (!supabase) return { error: new Error("Supabaseが設定されていません") };
  const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).toString();
  return supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  });
}
