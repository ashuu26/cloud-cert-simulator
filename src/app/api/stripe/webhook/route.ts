import type { NextRequest } from "next/server";
import { log } from "@/lib/logger";
import { handleWebhookEvent, verifyWebhook } from "@/lib/services/billing";
import { enforceRateLimit, json, route } from "@/lib/server/http";

/**
 * Stripe webhook. The signature is verified against the RAW body before
 * anything else happens. Entitlements change only as a result of this route.
 */
export const POST = route("stripe.webhook", async (req: NextRequest) => {
  enforceRateLimit(req, "webhook");
  const raw = await req.text();
  const event = verifyWebhook(raw, req.headers.get("stripe-signature"));
  const outcome = await handleWebhookEvent(event);
  log.info("stripe webhook", { eventId: event.id, type: event.type, outcome });
  return json({ received: true, outcome });
});
