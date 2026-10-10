import type { NextRequest } from "next/server";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { errors } from "@/lib/errors";
import { createCheckoutUrl } from "@/lib/services/billing";
import { assertSameOrigin, enforceRateLimit } from "@/lib/server/http";
import { formErrorRedirect, redirectTo } from "@/lib/server/forms";

/** HTML form endpoint: POST plan=<id> → 303 to Stripe Checkout. */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const form = await req.formData();
    const planId = String(form.get("plan") ?? "");
    const user = await getCurrentUser();
    if (!user) return redirectTo(`/sign-in?next=${encodeURIComponent("/pricing")}`);
    enforceRateLimit(req, "billing", user.id);
    const profile = await getProfile(user.id);
    if (!profile) throw errors.unauthorized();
    return redirectTo(await createCheckoutUrl(user, profile, planId));
  } catch (err) {
    return formErrorRedirect("billing.checkout", err, "/pricing");
  }
}
