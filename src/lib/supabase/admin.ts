import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

let client: SupabaseClient | null = null;

/**
 * Service-role client: bypasses RLS. Only use it in server code, and only after
 * the caller has been authenticated and authorised.
 */
export function adminDb(): SupabaseClient {
  const key = serverEnv().supabaseServiceRoleKey;
  if (!publicEnv.supabaseUrl || !key) {
    throw new Error("Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  client ??= createClient(publicEnv.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
