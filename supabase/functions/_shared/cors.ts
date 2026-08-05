import { AppError } from "./errors.ts";

const LOCAL_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

function configuredOrigins(): Set<string> {
  const configured = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value: string) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return new Set(configured.length > 0 ? configured : LOCAL_ORIGINS);
}

export function corsHeaders(origin: string | null): Record<string, string> {
  if (origin && !configuredOrigins().has(origin.replace(/\/$/, ""))) {
    throw new AppError("UNAUTHORIZED", 403);
  }
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Expose-Headers": "X-Diagnostic-Row-Version",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

export function preflightResponse(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}
