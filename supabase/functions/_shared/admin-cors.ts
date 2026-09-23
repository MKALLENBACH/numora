import { AdminAuthError } from "./admin-auth.ts";

const LOCAL_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

function configuredOrigins(): Set<string> {
  const configured = (Deno.env.get("ADMIN_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value: string) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return new Set(configured.length > 0 ? configured : LOCAL_ORIGINS);
}

export function assertAdminOrigin(origin: string | null) {
  if (!origin) throw new AdminAuthError("UNAUTHORIZED", 403, "ORIGIN_REQUIRED");
  const normalized = origin.replace(/\/$/, "");
  if (!configuredOrigins().has(normalized)) {
    throw new AdminAuthError("UNAUTHORIZED", 403, "ORIGIN_NOT_ALLOWED");
  }
  return normalized;
}

export function adminCorsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}
