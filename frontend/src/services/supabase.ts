import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (key?.startsWith("sb_secret_")) throw new Error("Use a Supabase publishable key, never a secret key, in the frontend.");
export const supabase = url && key ? createClient(url, key, {
  auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;
export const authConfigurationError = "Sign-in is unavailable. Configure the Supabase project URL and publishable key, then restart the frontend.";
