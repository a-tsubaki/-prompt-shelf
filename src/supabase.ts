import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const isSupabaseConfigured = Boolean(url && key);
export const supabase = isSupabaseConfigured ? createClient<Database>(url!, key!) : null;

export async function signInWithGitHub() {
  if (!supabase) return;
  await supabase.auth.signInWithOAuth({ provider: "github", options: { redirectTo: `${window.location.origin}${window.location.pathname}` } });
}
