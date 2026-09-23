import { z } from "zod";

import {
  AdminAuthError,
  requireAdminUser,
  requireRole,
} from "../_shared/admin-auth.ts";
import {
  AdminDiagnosticListDataSchema,
  AdminDiagnosticListRequestSchema,
} from "../_shared/admin-diagnostics-contract.ts";
import { adminCorsHeaders, assertAdminOrigin } from "../_shared/admin-cors.ts";

const MAX_BODY_BYTES = 32_768;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const ALLOWED_ROLES = ["ADMIN", "CONSULTANT", "VIEWER"] as const;

type ListErrorCode =
  | "UNAUTHORIZED"
  | "ACCESS_DENIED"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "BACKEND_FAILURE"
  | "QUERY_TIMEOUT";

class AdminDiagnosticListError extends Error {
  constructor(
    public readonly code: ListErrorCode,
    public readonly status: number,
    public readonly message: string,
  ) {
    super(message);
  }
}

function responseHeaders(origin: string) {
  return { ...adminCorsHeaders(origin), "Content-Type": "application/json; charset=utf-8" };
}

function jsonResponse(origin: string, body: unknown, status = 200, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: { ...responseHeaders(origin), ...extraHeaders },
  });
}

function configuredRateLimit() {
  const configured = Number(Deno.env.get("ADMIN_DIAGNOSTICS_RATE_LIMIT") ?? "60");
  return Number.isInteger(configured) && configured >= 10 && configured <= 600 ? configured : 60;
}

async function readJsonBody(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    throw new AdminDiagnosticListError("VALIDATION_ERROR", 422, "Revise os filtros informados.");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new AdminDiagnosticListError("VALIDATION_ERROR", 422, "Revise os filtros informados.");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AdminDiagnosticListError("VALIDATION_ERROR", 422, "Revise os filtros informados.");
  }
}

function safeError(error: unknown) {
  if (error instanceof AdminDiagnosticListError) return error;
  if (error instanceof AdminAuthError) {
    if (error.code === "UNAUTHORIZED") {
      return new AdminDiagnosticListError(
        "UNAUTHORIZED",
        401,
        "Não foi possível validar sua sessão.",
      );
    }
    if (error.code === "ACCESS_DENIED") {
      return new AdminDiagnosticListError(
        "ACCESS_DENIED",
        403,
        "Sua conta não possui acesso autorizado ao ADM.",
      );
    }
  }
  if (error instanceof z.ZodError) {
    return new AdminDiagnosticListError(
      "VALIDATION_ERROR",
      422,
      "Revise os filtros informados.",
    );
  }
  return new AdminDiagnosticListError(
    "BACKEND_FAILURE",
    503,
    "Não foi possível carregar os diagnósticos.",
  );
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
    return jsonResponse(
      origin,
      { data: null, error: { code: "VALIDATION_ERROR", message: "Método não permitido." } },
      405,
    );
  }

  const referenceCode = `NUML${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  try {
    const { context, admin } = await requireAdminUser(request);
    requireRole(context, ALLOWED_ROLES);
    const body = AdminDiagnosticListRequestSchema.parse(await readJsonBody(request));

    const { data: accepted, error: rateLimitError } = await admin.rpc(
      "diagnostic_consume_rate_limit",
      {
        p_owner_user_id: context.userId,
        p_scope: "admin-diagnostics-list",
        p_max_requests: configuredRateLimit(),
        p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      },
    );
    if (rateLimitError) {
      throw new AdminDiagnosticListError(
        "BACKEND_FAILURE",
        503,
        "Não foi possível carregar os diagnósticos.",
      );
    }
    if (accepted !== true) {
      throw new AdminDiagnosticListError(
        "RATE_LIMITED",
        429,
        "Muitas consultas foram realizadas. Aguarde um momento e tente novamente.",
      );
    }

    const { data, error } = await admin.rpc("admin_list_diagnostics", { p_request: body });
    if (error) {
      const timedOut = error.code === "57014" || error.message?.includes("statement timeout");
      throw new AdminDiagnosticListError(
        timedOut ? "QUERY_TIMEOUT" : "BACKEND_FAILURE",
        timedOut ? 504 : 503,
        timedOut
          ? "A consulta demorou mais do que o esperado. Tente novamente."
          : "Não foi possível carregar os diagnósticos.",
      );
    }

    const parsed = AdminDiagnosticListDataSchema.safeParse(data);
    if (!parsed.success) {
      throw new AdminDiagnosticListError(
        "BACKEND_FAILURE",
        503,
        "Não foi possível carregar os diagnósticos.",
      );
    }
    return jsonResponse(origin, { data: parsed.data, error: null });
  } catch (error) {
    const safe = safeError(error);
    if (safe.code === "BACKEND_FAILURE" || safe.code === "QUERY_TIMEOUT") {
      console.error("Admin diagnostic list request failed.", {
        referenceCode,
        code: safe.code,
      });
    }
    return jsonResponse(
      origin,
      { data: null, error: { code: safe.code, message: safe.message, referenceCode } },
      safe.status,
      safe.code === "RATE_LIMITED" ? { "Retry-After": "60" } : {},
    );
  }
});
