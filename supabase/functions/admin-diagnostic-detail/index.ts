import { z } from "zod";

import {
  AdminAuthError,
  requireAdminUser,
  requireRole,
} from "../_shared/admin-auth.ts";
import {
  AdminDiagnosticDetailDataSchema,
  AdminDiagnosticDetailRequestSchema,
} from "../_shared/admin-diagnostic-detail-contract.ts";
import { adminCorsHeaders, assertAdminOrigin } from "../_shared/admin-cors.ts";

const MAX_BODY_BYTES = 8_192;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const ALLOWED_ROLES = ["ADMIN", "CONSULTANT", "VIEWER"] as const;

type DetailErrorCode =
  | "UNAUTHORIZED"
  | "ACCESS_DENIED"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "BACKEND_FAILURE"
  | "QUERY_TIMEOUT";

class AdminDiagnosticDetailError extends Error {
  constructor(
    public readonly code: DetailErrorCode,
    public readonly status: number,
    public readonly safeMessage: string,
  ) {
    super(safeMessage);
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
  const configured = Number(Deno.env.get("ADMIN_DIAGNOSTIC_DETAIL_RATE_LIMIT") ?? "120");
  return Number.isInteger(configured) && configured >= 10 && configured <= 600 ? configured : 120;
}

async function readJsonBody(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    throw new AdminDiagnosticDetailError("VALIDATION_ERROR", 422, "Revise a solicitação informada.");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new AdminDiagnosticDetailError("VALIDATION_ERROR", 422, "Revise a solicitação informada.");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AdminDiagnosticDetailError("VALIDATION_ERROR", 422, "Revise a solicitação informada.");
  }
}

function safeError(error: unknown) {
  if (error instanceof AdminDiagnosticDetailError) return error;
  if (error instanceof AdminAuthError) {
    if (error.code === "UNAUTHORIZED") {
      return new AdminDiagnosticDetailError(
        "UNAUTHORIZED",
        401,
        "Não foi possível validar sua sessão.",
      );
    }
    if (error.code === "ACCESS_DENIED") {
      return new AdminDiagnosticDetailError(
        "ACCESS_DENIED",
        403,
        "Sua conta não possui acesso autorizado ao ADM.",
      );
    }
  }
  if (error instanceof z.ZodError) {
    return new AdminDiagnosticDetailError(
      "VALIDATION_ERROR",
      422,
      "Revise a solicitação informada.",
    );
  }
  return new AdminDiagnosticDetailError(
    "BACKEND_FAILURE",
    503,
    "Não foi possível carregar este diagnóstico.",
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

  const referenceCode = `NUMD${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  try {
    const { context, admin } = await requireAdminUser(request);
    requireRole(context, ALLOWED_ROLES);
    const body = AdminDiagnosticDetailRequestSchema.parse(await readJsonBody(request));

    const { data: accepted, error: rateLimitError } = await admin.rpc(
      "diagnostic_consume_rate_limit",
      {
        p_owner_user_id: context.userId,
        p_scope: "admin-diagnostic-detail",
        p_max_requests: configuredRateLimit(),
        p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      },
    );
    if (rateLimitError) {
      throw new AdminDiagnosticDetailError(
        "BACKEND_FAILURE",
        503,
        "Não foi possível carregar este diagnóstico.",
      );
    }
    if (accepted !== true) {
      throw new AdminDiagnosticDetailError(
        "RATE_LIMITED",
        429,
        "Muitas consultas foram realizadas. Aguarde um momento e tente novamente.",
      );
    }

    const { data, error } = await admin.rpc("admin_get_diagnostic_detail", {
      p_diagnostic_id: body.diagnosticId,
      p_section: body.section,
    });
    if (error) {
      const timedOut = error.code === "57014" || error.message?.includes("statement timeout");
      throw new AdminDiagnosticDetailError(
        timedOut ? "QUERY_TIMEOUT" : "BACKEND_FAILURE",
        timedOut ? 504 : 503,
        timedOut
          ? "A consulta demorou mais do que o esperado. Tente novamente."
          : "Não foi possível carregar este diagnóstico.",
      );
    }
    if (data === null) {
      throw new AdminDiagnosticDetailError(
        "NOT_FOUND",
        404,
        "Diagnóstico não encontrado.",
      );
    }

    const parsed = AdminDiagnosticDetailDataSchema.safeParse(data);
    if (!parsed.success) {
      throw new AdminDiagnosticDetailError(
        "BACKEND_FAILURE",
        503,
        "Não foi possível carregar este diagnóstico.",
      );
    }
    return jsonResponse(origin, { data: parsed.data, error: null });
  } catch (error) {
    const safe = safeError(error);
    if (safe.code === "BACKEND_FAILURE" || safe.code === "QUERY_TIMEOUT") {
      console.error("Admin diagnostic detail request failed.", {
        referenceCode,
        code: safe.code,
      });
    }
    return jsonResponse(
      origin,
      { data: null, error: { code: safe.code, message: safe.safeMessage, referenceCode } },
      safe.status,
      safe.code === "RATE_LIMITED" ? { "Retry-After": "60" } : {},
    );
  }
});
