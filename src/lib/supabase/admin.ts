import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireServerEnv } from "@/lib/env";
import { publicEnv } from "@/lib/public-env";
import type { Database } from "@/types/database";

/**
 * Service-role client. Bypasses RLS — use only for trusted server jobs
 * (ingestion, imports). Never pass user-controlled filters without scoping.
 */
export function createAdminClient() {
  return createClient<Database>(
    publicEnv.supabaseUrl,
    requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
