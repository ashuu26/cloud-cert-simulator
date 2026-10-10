import type { NextRequest } from "next/server";
import { log } from "@/lib/logger";
import { safeNextPath } from "@/lib/safe-redirect";
import { enforceRateLimit } from "@/lib/server/http";
import { redirectTo } from "@/lib/server/forms";
import { createUserClient } from "@/lib/supabase/server";

/** OAuth redirect target: exchanges the one-time code for a session cookie. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));
  const fail = (code: string) => redirectTo(`/sign-in?error=${code}&next=${encodeURIComponent(next)}`);

  try {
    enforceRateLimit(req, "auth");
  } catch {
    return fail("rate_limited");
  }

  // The provider sends ?error=access_denied when the user cancels the consent screen.
  const providerError = params.get("error");
  if (providerError) return fail(providerError === "access_denied" ? "cancelled" : "oauth_failed");

  const code = params.get("code");
  if (!code) return fail("oauth_failed");

  const supabase = await createUserClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    log.warn("oauth exchange failed", { error: error.message });
    return fail("oauth_failed");
  }
  return redirectTo(next);
}
