import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, isAdmin, type SessionUser } from "@/lib/auth";
import { errors, HttpError } from "@/lib/errors";
import { publicEnv } from "@/lib/env";
import { log } from "@/lib/logger";
import { limit, POLICIES } from "@/lib/rate-limit";

export { errors, HttpError };

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/**
 * CSRF defence for cookie-authenticated mutations: the request must come from
 * our own origin. Auth cookies are also SameSite=Lax, so this is a second layer.
 */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const allowed = new Set([publicEnv.siteUrl, req.nextUrl.origin]);
  if (origin) {
    if (!allowed.has(origin)) throw errors.forbidden("Cross-site request blocked.");
    return;
  }
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite !== "same-origin") throw errors.forbidden("Cross-site request blocked.");
}

export function enforceRateLimit(req: NextRequest, policy: keyof typeof POLICIES, identity?: string) {
  const { max, windowMs } = POLICIES[policy];
  const result = limit(`${policy}:${identity ?? clientIp(req)}`, max, windowMs);
  if (!result.ok) {
    const err = new HttpError(429, "rate_limited", "Too many requests. Please slow down and try again shortly.");
    err.retryAfter = result.retryAfterSeconds;
    throw err;
  }
}

export async function requireApiUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw errors.unauthorized();
  return user;
}

export async function readJson(req: NextRequest, maxBytes = 64 * 1024): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new HttpError(413, "payload_too_large", "Request body is too large.");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "payload_too_large", "Request body is too large.");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw errors.badRequest("Request body must be valid JSON.");
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

/** Wraps a route handler with consistent error responses and structured logging. */
export function route<C>(name: string, handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        const headers: Record<string, string> = { "Cache-Control": "no-store" };
        if (err.retryAfter) headers["Retry-After"] = String(err.retryAfter);
        if (err.status >= 500) log.error(`${name} failed`, { code: err.code, error: err });
        return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status, headers });
      }
      if (err instanceof ZodError) {
        return json({ error: { code: "invalid_input", message: err.issues[0]?.message ?? "Invalid input." } }, 400);
      }
      log.error(`${name} failed`, { error: err, path: req.nextUrl.pathname });
      return json({ error: { code: "internal", message: "Something went wrong. Please try again." } }, 500);
    }
  };
}

/** Admin API guard. Returns 404 rather than 403 so admin endpoints aren't discoverable. */
export async function requireApiAdmin(req: NextRequest): Promise<SessionUser> {
  const user = await requireApiUser();
  if (!(await isAdmin(user.id))) throw errors.notFound();
  enforceRateLimit(req, "admin", user.id);
  return user;
}
