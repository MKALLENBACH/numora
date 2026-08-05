export type PublicErrorCode =
  | "VALIDATION_ERROR"
  | "SESSION_EXPIRED"
  | "SESSION_NOT_FOUND"
  | "STATE_CONFLICT"
  | "RATE_LIMITED"
  | "AI_FALLBACK_ACTIVE"
  | "PERSISTENCE_UNAVAILABLE"
  | "UNAUTHORIZED"
  | "BLOCKED"
  | "GENERIC_ERROR";

const PUBLIC_MESSAGES: Record<PublicErrorCode, string> = {
  VALIDATION_ERROR: "Revise as informações indicadas para continuar.",
  SESSION_EXPIRED: "Esta sessão expirou. Para proteger suas informações, será necessário iniciar um novo diagnóstico.",
  SESSION_NOT_FOUND: "Não encontramos uma sessão ativa neste navegador.",
  STATE_CONFLICT: "O diagnóstico foi atualizado em outra solicitação. Recarregamos a versão mais recente sem apagar sua resposta.",
  RATE_LIMITED: "Muitas solicitações foram enviadas em pouco tempo. Aguarde um momento e tente novamente.",
  AI_FALLBACK_ACTIVE: "Alguns recursos de interpretação estão temporariamente indisponíveis. A entrevista continuará normalmente.",
  PERSISTENCE_UNAVAILABLE: "Não foi possível registrar as informações com segurança neste momento. Para evitar perda de dados, a entrevista foi pausada.",
  UNAUTHORIZED: "Não foi possível validar esta sessão.",
  BLOCKED: "Não foi possível continuar a entrevista dentro da finalidade proposta.",
  GENERIC_ERROR: "Não foi possível concluir esta ação. Suas informações foram preservadas. Tente novamente.",
};

export class AppError extends Error {
  constructor(
    public readonly code: PublicErrorCode,
    public readonly status = 400,
    public readonly fields?: Record<string, string>,
  ) {
    super(code);
  }
}

export function referenceCode(): string {
  return `NUM${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

export function mapPersistenceError(error: unknown): AppError {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("SESSION_EXPIRED")) return new AppError("SESSION_EXPIRED", 410);
  if (message.includes("SESSION_NOT_FOUND")) return new AppError("SESSION_NOT_FOUND", 404);
  if (message.includes("STATE_CONFLICT") || message.includes("40001")) return new AppError("STATE_CONFLICT", 409);
  if (message.includes("UNAUTHORIZED") || message.includes("42501")) return new AppError("UNAUTHORIZED", 401);
  if (message.includes("BLOCKED")) return new AppError("BLOCKED", 403);
  if (
    message.includes("TEMPORARY_EMAIL") || message.includes("REVIEW_LIMIT_REACHED") ||
    message.includes("INVALID_") || message.includes("QUESTION_LIMIT_REACHED") ||
    message.includes("IDEMPOTENCY_KEY_REUSED")
  ) return new AppError("VALIDATION_ERROR", 422);
  return new AppError("PERSISTENCE_UNAVAILABLE", 503);
}

export function errorResponse(error: unknown, code: string, headers: HeadersInit): Response {
  const safe = error instanceof AppError ? error : new AppError("GENERIC_ERROR", 500);
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", "no-store");
  return Response.json(
    {
      data: null,
      error: {
        code: safe.code,
        message: PUBLIC_MESSAGES[safe.code],
        referenceCode: code,
        retryable: !["BLOCKED", "UNAUTHORIZED"].includes(safe.code),
        ...(safe.fields ? { fields: safe.fields } : {}),
      },
    },
    { status: safe.status, headers: responseHeaders },
  );
}
