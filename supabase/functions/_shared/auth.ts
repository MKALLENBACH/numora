import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { AppError } from "./errors.ts";

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new AppError("GENERIC_ERROR", 500);
  return value;
}

export async function authenticate(request: Request): Promise<{ user: User; admin: SupabaseClient }> {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new AppError("UNAUTHORIZED", 401);

  const url = requiredEnv("SUPABASE_URL");
  const anonKey = requiredEnv("SUPABASE_ANON_KEY");
  const userClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${match[1]}` } },
  });
  const { data, error } = await userClient.auth.getUser(match[1]);
  if (error || !data.user || data.user.is_anonymous !== true) {
    throw new AppError("UNAUTHORIZED", 401);
  }

  // This client exists only inside the Edge isolate. Its credential is never returned or logged.
  const admin = createClient(url, requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return { user: data.user, admin };
}
