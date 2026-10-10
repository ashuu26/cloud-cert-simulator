import type { NextRequest } from "next/server";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { log } from "@/lib/logger";
import { safeNextPath } from "@/lib/safe-redirect";
import { assertSameOrigin, enforceRateLimit } from "@/lib/server/http";
import { redirectTo } from "@/lib/server/forms";
import { createUserClient } from "@/lib/supabase/server";

const PROVIDERS = new Set(["google", "github"]);

/**
 * Starts the OAuth flow on the server (PKCE). The provider client secrets live
 * in Supabase Auth settings and never reach the browser.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const next = safeNextPath(String(form.get("next") ?? ""));
  const back = (code: string) => redirectTo(`/sign-in?error=${code}&next=${encodeURIComponent(next)}`);
  try {
    assertSameOrigin(req);
    enforceRateLimit(req, "auth");
  } catch {
    return back("rate_limited");
  }
  const provider = String(form.get("provider") ?? "");
  if (!PROVIDERS.has(provider)) return back("provider");
  if (!isSupabaseConfigured()) return back("not_configured");

  const supabase = await createUserClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider as "google" | "github",
    options: {
      redirectTo: `${publicEnv.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      skipBrowserRedirect: true,
    },
  });
  if (error || !data.url) {
    log.warn("oauth start failed", { provider, error: error?.message });
    return back("oauth_start");
  }
  return redirectTo(data.url);
}
