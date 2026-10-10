import type { NextRequest } from "next/server";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { errors } from "@/lib/errors";
import { createPortalUrl } from "@/lib/services/billing";
import { assertSameOrigin, enforceRateLimit } from "@/lib/server/http";
import { formErrorRedirect, redirectTo } from "@/lib/server/forms";

/** HTML form endpoint → 303 to the Stripe customer portal (cancel, update card, invoices). */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await getCurrentUser();
    if (!user) return redirectTo("/sign-in?next=/account");
    enforceRateLimit(req, "billing", user.id);
    const profile = await getProfile(user.id);
    if (!profile) throw errors.unauthorized();
    return redirectTo(await createPortalUrl(profile, user));
  } catch (err) {
    return formErrorRedirect("billing.portal", err, "/account");
  }
}
