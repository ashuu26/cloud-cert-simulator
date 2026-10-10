import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createUserClient } from "@/lib/supabase/server";
import { adminDb } from "@/lib/supabase/admin";

export interface SessionUser {
  id: string;
  email: string;
}

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  auth_provider: string | null;
  providers: string[];
  role: "user" | "admin";
  stripe_customer_id: string | null;
  created_at: string;
}

/**
 * The verified user for this request, or null. Uses getUser(), which checks the
 * token with Supabase Auth (never trust getSession() alone on the server).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  // Anything that depends on the user must render per request, never at build time.
  await connection();
  if (!isSupabaseConfigured()) return null;
  const supabase = await createUserClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? "" };
});

export const getProfile = cache(async (userId: string): Promise<Profile | null> => {
  const { data } = await adminDb()
    .from("profiles")
    .select("id, email, display_name, auth_provider, providers, role, stripe_customer_id, created_at")
    .eq("id", userId)
    .maybeSingle();
  return (data as Profile | null) ?? null;
});

export async function requireUser(nextPath: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  return user;
}

/**
 * Every admin page and admin API route must call this itself. Layout checks
 * alone are not enough because pages and layouts render in parallel.
 */
export async function requireAdmin(nextPath = "/admin"): Promise<{ user: SessionUser; profile: Profile }> {
  const user = await requireUser(nextPath);
  const profile = await getProfile(user.id);
  if (profile?.role !== "admin") notFound();
  return { user, profile };
}

export async function isAdmin(userId: string): Promise<boolean> {
  return (await getProfile(userId))?.role === "admin";
}
