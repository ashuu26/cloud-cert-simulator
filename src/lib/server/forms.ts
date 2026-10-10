import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { HttpError } from "@/lib/errors";
import { publicEnv } from "@/lib/env";
import { log } from "@/lib/logger";

export function isFormPost(req: NextRequest): boolean {
  const type = req.headers.get("content-type") ?? "";
  return type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data");
}

/** 303 so the browser follows with GET after a form POST. */
export function redirectTo(path: string) {
  const url = path.startsWith("http") ? path : `${publicEnv.siteUrl}${path}`;
  return NextResponse.redirect(url, 303);
}

/** For HTML form endpoints: turn errors into a redirect back with ?error=code. */
export function formErrorRedirect(name: string, err: unknown, backTo: string) {
  const code = err instanceof HttpError ? err.code : "internal";
  if (!(err instanceof HttpError) || err.status >= 500) log.error(`${name} failed`, { error: err });
  const sep = backTo.includes("?") ? "&" : "?";
  return redirectTo(`${backTo}${sep}error=${encodeURIComponent(code)}`);
}
