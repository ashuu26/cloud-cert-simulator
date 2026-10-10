import type { NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { assertSameOrigin } from "@/lib/server/http";
import { redirectTo } from "@/lib/server/forms";
import { createUserClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
  } catch {
    return redirectTo("/");
  }
  if (isSupabaseConfigured()) {
    const supabase = await createUserClient();
    await supabase.auth.signOut();
  }
  return redirectTo("/?signed_out=1");
}
