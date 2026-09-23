import {
  AdminDiagnosticListDataSchema,
  AdminDiagnosticListRequestSchema,
  type AdminDiagnosticListRequest,
} from "./diagnostics-contract";
import {
  AdminClientError,
  adminFunctionFetch,
  currentAdminAccessToken,
} from "./admin-transport";

type ErrorPayload = {
  data?: unknown;
  error?: {
    code?: string;
    message?: string;
    referenceCode?: string;
  } | null;
};

const knownCodes = new Set([
  "UNAUTHORIZED",
  "ACCESS_DENIED",
  "VALIDATION_ERROR",
  "RATE_LIMITED",
  "QUERY_TIMEOUT",
]);

function toClientError(response: Response, payload: ErrorPayload | null) {
  const remoteCode = payload?.error?.code ?? "";
  const code = knownCodes.has(remoteCode)
    ? remoteCode as "UNAUTHORIZED" | "ACCESS_DENIED" | "VALIDATION_ERROR" | "RATE_LIMITED" | "QUERY_TIMEOUT"
    : response.status === 401
      ? "UNAUTHORIZED"
      : response.status === 403
        ? "ACCESS_DENIED"
        : "GENERIC_ERROR";

  const fallback = code === "RATE_LIMITED"
    ? "Muitas consultas foram realizadas. Aguarde um momento e tente novamente."
    : code === "QUERY_TIMEOUT"
      ? "A consulta demorou mais do que o esperado. Tente novamente."
      : code === "VALIDATION_ERROR"
        ? "Revise os filtros informados."
        : code === "ACCESS_DENIED"
          ? "Sua conta não possui acesso autorizado ao ADM."
          : code === "UNAUTHORIZED"
            ? "Não foi possível validar sua sessão."
            : "Não foi possível carregar os diagnósticos.";

  return new AdminClientError(
    code,
    payload?.error?.message || fallback,
    payload?.error?.referenceCode,
  );
}

export async function listAdminDiagnostics(
  request: AdminDiagnosticListRequest,
  signal: AbortSignal,
) {
  const validatedRequest = AdminDiagnosticListRequestSchema.parse(request);
  try {
    const response = await adminFunctionFetch({
      functionName: "admin-diagnostics-list",
      accessToken: await currentAdminAccessToken(),
      body: validatedRequest,
      signal,
    });
    const payload = await response.json().catch(() => null) as ErrorPayload | null;
    if (!response.ok || !payload?.data) throw toClientError(response, payload);

    const parsed = AdminDiagnosticListDataSchema.safeParse(payload.data);
    if (!parsed.success) {
      throw new AdminClientError("GENERIC_ERROR", "Não foi possível carregar os diagnósticos.");
    }
    return parsed.data;
  } catch (error) {
    if (signal.aborted || (error instanceof DOMException && error.name === "AbortError")) throw error;
    if (error instanceof AdminClientError) throw error;
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new AdminClientError(
        "QUERY_TIMEOUT",
        "A consulta demorou mais do que o esperado. Tente novamente.",
      );
    }
    throw new AdminClientError("GENERIC_ERROR", "Não foi possível carregar os diagnósticos.");
  }
}
