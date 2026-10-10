/**
 * Row Level Security checks against a real Supabase instance.
 *
 *   npx supabase start && npm run test:integration
 *
 * Uses throwaway email/password users created with the service role (local only).
 */
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

config({ path: ".env.local" });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const enabled = Boolean(url && anonKey && serviceKey);

describe.skipIf(!enabled)("RLS policies", () => {
  const admin = enabled ? createClient(url, serviceKey, { auth: { persistSession: false } }) : (null as unknown as SupabaseClient);
  const anon = enabled ? createClient(url, anonKey, { auth: { persistSession: false } }) : (null as unknown as SupabaseClient);
  const users: { id: string; client: SupabaseClient }[] = [];
  let certId = "";
  let sessionOfB = "";

  async function makeUser() {
    const email = `rls-${randomUUID()}@example.test`;
    const password = `Pw-${randomUUID()}`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    const client = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
    if (signInErr) throw signInErr;
    return { id: data.user.id, client };
  }

  beforeAll(async () => {
    users.push(await makeUser(), await makeUser());
    const { data: cert } = await admin.from("certifications").select("id").limit(1).single();
    certId = cert!.id;
    const { data: q } = await admin.from("questions").select("id").eq("certification_id", certId).limit(1).single();
    const { data: s, error } = await admin
      .from("practice_sessions")
      .insert({ user_id: users[1].id, certification_id: certId, mode: "learning", scope: "free", question_ids: [q!.id] })
      .select("id")
      .single();
    if (error) throw error;
    sessionOfB = s.id;
  });

  afterAll(async () => {
    for (const u of users) await admin.auth.admin.deleteUser(u.id);
  });

  it("creates a profile for each new auth user", async () => {
    const { data } = await users[0].client.from("profiles").select("id, role").eq("id", users[0].id).single();
    expect(data).toMatchObject({ id: users[0].id, role: "user" });
  });

  it("hides the question bank from anonymous and signed-in clients", async () => {
    for (const c of [anon, users[0].client]) {
      const { data, error } = await c.from("questions").select("id, correct_answer").limit(5);
      expect(data ?? []).toHaveLength(0);
      expect(error?.code).toBe("42501"); // permission denied
    }
  });

  it("exposes the public catalogue", async () => {
    const { data: certs } = await anon.from("certifications").select("slug");
    const { data: plans } = await anon.from("plans").select("id");
    expect(certs?.length).toBeGreaterThan(0);
    expect(plans?.length).toBeGreaterThan(0);
  });

  it("does not let a user read another user's profile or sessions", async () => {
    const a = users[0].client;
    const { data: otherProfile } = await a.from("profiles").select("id").eq("id", users[1].id);
    expect(otherProfile).toEqual([]);
    const { data: otherSession } = await a.from("practice_sessions").select("id").eq("id", sessionOfB);
    expect(otherSession).toEqual([]);
    const { data: own } = await users[1].client.from("practice_sessions").select("id").eq("id", sessionOfB);
    expect(own).toHaveLength(1);
  });

  it("does not let clients write scores, entitlements, subscriptions or roles", async () => {
    const a = users[0].client;
    const writes = await Promise.all([
      a.from("user_entitlements").insert({ user_id: users[0].id, certification_id: certId, access_level: "premium", valid_until: "2099-01-01" }),
      a.from("subscriptions").insert({ user_id: users[0].id, provider_customer_id: "cus_x", provider_subscription_id: `sub_${randomUUID()}`, status: "active" }),
      a.from("practice_sessions").update({ score: 100 }).eq("id", sessionOfB),
      a.from("profiles").update({ role: "admin" }).eq("id", users[0].id),
      a.from("plans").update({ amount_cents: 1 }).eq("id", "premium_monthly"),
    ]);
    for (const w of writes) expect(w.error?.code).toBe("42501");
    const { data: me } = await admin.from("profiles").select("role").eq("id", users[0].id).single();
    expect(me?.role).toBe("user");
  });

  it("keeps the import function and billing ledger server-only", async () => {
    const { error } = await users[0].client.rpc("import_questions", { p_rows: [] });
    expect(error).not.toBeNull();
    const { error: ledgerErr } = await users[0].client.from("billing_events").select("id");
    expect(ledgerErr?.code).toBe("42501");
  });
});
