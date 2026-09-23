import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  AdminAuthError,
  createAdminServiceClient,
  requireAdminUser,
  writeAdminAuditEvent,
} from "../_shared/admin-auth.ts";
import { adminCorsHeaders, assertAdminOrigin } from "../_shared/admin-cors.ts";

const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SESSION") }).strict(),
  z.object({ action: z.literal("LOGIN") }).strict(),
  z.object({ action: z.literal("LOGOUT") }).strict(),
  z.object({
    action: z.literal("RECOVER"),
    email: z.email().max(320),
    redirectTo: z.url().max(1000),
  }).strict(),
]);

function responseHeaders(origin: string) {
  return { ...adminCorsHeaders(origin), "Content-Type": "application/json; charset=utf-8" };
}

function jsonResponse(origin: string, body: unknown, status = 200) {
  return Response.json(body, { status, headers: responseHeaders(origin) });
}

function safeErrorResponse(origin: string, error: unknown) {
  const safe = error instanceof AdminAuthError
    ? error
    : new AdminAuthError("INTERNAL_ERROR", 500, "UNEXPECTED_ERROR");
  const message = safe.code === "ACCESS_DENIED"
    ? "Sua conta não possui acesso autorizado ao ADM."
    : safe.code === "UNAUTHORIZED"
      ? "Não foi possível validar sua sessão."
      : "Não foi possível concluir esta ação.";
  return jsonResponse(origin, { data: null, error: { code: safe.code, message } }, safe.status);
}

function validateRecoveryRedirect(origin: string, redirectTo: string) {
  const parsed = new URL(redirectTo);
  if (
    parsed.origin !== origin ||
    !parsed.pathname.endsWith("/adm/recuperar-acesso/") ||
    parsed.username ||
    parsed.password
  ) {
    throw new AdminAuthError("UNAUTHORIZED", 403, "INVALID_RECOVERY_REDIRECT");
  }
  return parsed.toString();
}

Deno.serve(async (request) => {
  let origin = "";
  try {
    origin = assertAdminOrigin(request.headers.get("origin"));
  } catch {
    return Response.json(
      { data: null, error: { code: "UNAUTHORIZED", message: "Origem não autorizada." } },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: adminCorsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return jsonResponse(origin, { data: null, error: { code: "METHOD_NOT_ALLOWED" } }, 405);
  }

  try {
    const body = RequestSchema.parse(await request.json());

    if (body.action === "RECOVER") {
      const redirectTo = validateRecoveryRedirect(origin, body.redirectTo);
      const url = Deno.env.get("SUPABASE_URL")?.trim();
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim();
      if (!url || !anonKey) {
        throw new AdminAuthError("CONFIGURATION_ERROR", 500, "MISSING_SERVER_CONFIGURATION");
      }
      const authClient = createClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error } = await authClient.auth.resetPasswordForEmail(body.email, { redirectTo });
      await writeAdminAuditEvent(createAdminServiceClient(), {
        eventType: "PASSWORD_RECOVERY_REQUESTED",
        succeeded: !error,
        reasonCode: error ? "PROVIDER_REJECTED" : undefined,
      });
      return jsonResponse(origin, { data: { accepted: true }, error: null });
    }

    const { context, email, admin } = await requireAdminUser(request);
    if (body.action === "LOGIN" || body.action === "LOGOUT") {
      await writeAdminAuditEvent(admin, {
        actorUserId: context.userId,
        profileId: context.profileId,
        eventType: body.action === "LOGIN" ? "ADMIN_LOGIN" : "ADMIN_LOGOUT",
        succeeded: true,
      });
    }

    return jsonResponse(origin, { data: { ...context, email }, error: null });
  } catch (error) {
    if (error instanceof AdminAuthError && error.actorUserId) {
      await writeAdminAuditEvent(createAdminServiceClient(), {
        actorUserId: error.actorUserId,
        profileId: error.profileId,
        eventType: "ADMIN_ACCESS_DENIED",
        succeeded: false,
        reasonCode: error.reasonCode,
      });
    }
    if (error instanceof z.ZodError) {
      return jsonResponse(
        origin,
        { data: null, error: { code: "VALIDATION_ERROR", message: "Revise os dados informados." } },
        422,
      );
    }
    return safeErrorResponse(origin, error);
  }
});
