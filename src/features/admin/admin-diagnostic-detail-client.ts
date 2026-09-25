import {
  AdminDiagnosticDetailDataSchema,
  AdminDiagnosticDetailRequestSchema,
  type AdminDiagnosticDetailRequest,
} from "./diagnostic-detail-contract";
import {
  AdminClientError,
  adminFunctionJson,
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
  "NOT_FOUND",
  "RATE_LIMITED",
  "QUERY_TIMEOUT",
]);

function toClientError(response: Response, payload: ErrorPayload | null) {
  const remoteCode = payload?.error?.code ?? "";
  const code = knownCodes.has(remoteCode)
    ? remoteCode as "UNAUTHORIZED" | "ACCESS_DENIED" | "VALIDATION_ERROR" | "NOT_FOUND" | "RATE_LIMITED" | "QUERY_TIMEOUT"
    : response.status === 401
      ? "UNAUTHORIZED"
      : response.status === 403
        ? "ACCESS_DENIED"
        : response.status === 404
          ? "NOT_FOUND"
          : "GENERIC_ERROR";

  const fallback = code === "NOT_FOUND"
    ? "Diagnóstico não encontrado."
    : code === "RATE_LIMITED"
      ? "Muitas consultas foram realizadas. Aguarde um momento e tente novamente."
      : code === "QUERY_TIMEOUT"
        ? "A consulta demorou mais do que o esperado. Tente novamente."
        : code === "ACCESS_DENIED"
          ? "Sua conta não possui acesso autorizado ao ADM."
          : code === "UNAUTHORIZED"
            ? "Não foi possível validar sua sessão."
            : "Não foi possível carregar este diagnóstico.";

  return new AdminClientError(
    code,
    payload?.error?.message || fallback,
    payload?.error?.referenceCode,
  );
}

export async function getAdminDiagnosticDetail(
  request: AdminDiagnosticDetailRequest,
  signal: AbortSignal,
) {
  const validatedRequest = AdminDiagnosticDetailRequestSchema.parse(request);
  try {
    const { response, payload: unknownPayload } = await adminFunctionJson({
      functionName: "admin-diagnostic-detail",
      accessToken: await currentAdminAccessToken(),
      body: validatedRequest,
      signal,
    });
    const payload = unknownPayload as ErrorPayload | null;
    if (!response.ok || !payload?.data) throw toClientError(response, payload);

    const parsed = AdminDiagnosticDetailDataSchema.safeParse(payload.data);
    if (!parsed.success) {
      throw new AdminClientError("GENERIC_ERROR", "Não foi possível carregar este diagnóstico.");
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
    throw new AdminClientError("GENERIC_ERROR", "Não foi possível carregar este diagnóstico.");
  }
}
