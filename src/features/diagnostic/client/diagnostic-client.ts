import { createClient } from "@supabase/supabase-js";

import { PublicDiagnosticStateSchema } from "@/features/diagnostic/contracts/public";

import { publicErrorMessages } from "./content";
import { diagnosticPublicConfig, hasDiagnosticBackendConfiguration } from "./config";
import type {
  DiagnosticErrorCode,
  LocalDraft,
  PublicApiError,
  PublicDiagnosticState,
} from "./types";

const SESSION_STORAGE_KEY = "numora.diagnostic.session.v1";
const DRAFT_STORAGE_KEY = "numora.diagnostic.draft.v1";

type StoredDiagnostic = {
  diagnosticId: string;
  sessionId: string;
};

type ApiEnvelope<T> = {
  data?: T;
  error?: Partial<PublicApiError> | null;
  meta?: {
    rowVersion?: number;
  };
};

export class DiagnosticClientError extends Error {
  readonly code: DiagnosticErrorCode;
  readonly referenceCode?: string;
  readonly retryable: boolean;

  constructor(error: PublicApiError) {
    super(error.message);
    this.name = "DiagnosticClientError";
    this.code = error.code;
    this.referenceCode = error.referenceCode;
    this.retryable = error.retryable ?? true;
  }
}

function safeRead<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: unknown) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A indisponibilidade do storage não deve descartar o valor mantido pelo React.
  }
}

function safeRemove(key: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Sem ação: o servidor continua sendo a fonte da verdade.
  }
}

function asError(payload: ApiEnvelope<unknown> | null, status: number): DiagnosticClientError {
  const rawCode = payload?.error?.code;
  const code: DiagnosticErrorCode =
    rawCode && rawCode in publicErrorMessages
      ? (rawCode as DiagnosticErrorCode)
      : status === 401
        ? "UNAUTHORIZED"
        : status === 429
          ? "RATE_LIMITED"
          : "GENERIC_ERROR";

  return new DiagnosticClientError({
    code,
    message: publicErrorMessages[code],
    referenceCode: payload?.error?.referenceCode,
    retryable: payload?.error?.retryable ?? !["BLOCKED", "UNAUTHORIZED"].includes(code),
  });
}

export function createClientRequestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createDiagnosticClient() {
  const supabaseUrl = diagnosticPublicConfig.supabaseUrl;
  const anonymousKey = diagnosticPublicConfig.supabaseKey;
  const supabase = hasDiagnosticBackendConfiguration()
    ? createClient(supabaseUrl, anonymousKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;
  let currentRowVersion: number | null = null;

  async function ensureAnonymousSession() {
    if (!supabase) {
      throw new DiagnosticClientError({
        code: "CONFIGURATION_ERROR",
        message: publicErrorMessages.CONFIGURATION_ERROR,
        retryable: false,
      });
    }

    const { data: existing, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      throw new DiagnosticClientError({
        code: "UNAUTHORIZED",
        message: publicErrorMessages.UNAUTHORIZED,
        retryable: true,
      });
    }
    if (existing.session?.access_token) return existing.session.access_token;

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.session?.access_token) {
      throw new DiagnosticClientError({
        code: "UNAUTHORIZED",
        message: publicErrorMessages.UNAUTHORIZED,
        retryable: true,
      });
    }
    return data.session.access_token;
  }

  async function invoke<T>(functionName: string, body: Record<string, unknown>) {
    const accessToken = await ensureAnonymousSession();
    const concurrencyProtected = new Set([
      "diagnostic-consent",
      "diagnostic-identification",
      "diagnostic-submit-answer",
    ]).has(functionName);
    if (functionName === "diagnostic-submit-answer" && currentRowVersion === null) {
      throw new DiagnosticClientError({
        code: "STATE_CONFLICT",
        message: publicErrorMessages.STATE_CONFLICT,
        retryable: false,
      });
    }
    const requestBody = concurrencyProtected && currentRowVersion !== null
      ? { ...body, rowVersion: currentRowVersion }
      : body;
    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        apikey: anonymousKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

    if (!response.ok || !payload?.data) throw asError(payload, response.status);
    const responseRowVersion = Number(
      payload.meta?.rowVersion ?? response.headers.get("X-Diagnostic-Row-Version"),
    );
    if (Number.isSafeInteger(responseRowVersion) && responseRowVersion > 0) {
      currentRowVersion = responseRowVersion;
    }
    const parsed = PublicDiagnosticStateSchema.safeParse(payload.data);
    if (!parsed.success) {
      throw new DiagnosticClientError({
        code: "GENERIC_ERROR",
        message: publicErrorMessages.GENERIC_ERROR,
        retryable: true,
      });
    }
    return parsed.data;
  }

  function rememberState(state: PublicDiagnosticState) {
    safeWrite(SESSION_STORAGE_KEY, {
      diagnosticId: state.diagnosticId,
      sessionId: state.sessionId,
    } satisfies StoredDiagnostic);
    return state;
  }

  return {
    isConfigured: hasDiagnosticBackendConfiguration(),
    async findResumable() {
      await ensureAnonymousSession();
      const stored = safeRead<StoredDiagnostic>(SESSION_STORAGE_KEY);
      try {
        const state = await invoke<PublicDiagnosticState>("diagnostic-state", {
          ...(stored ?? {}),
        });
        return state.canResume ? rememberState(state) : null;
      } catch (error) {
        if (error instanceof DiagnosticClientError && error.code === "SESSION_NOT_FOUND") return null;
        throw error;
      }
    },
    async start(clientRequestId: string) {
      return rememberState(
        await invoke<PublicDiagnosticState>("diagnostic-start", { clientRequestId }),
      );
    },
    async invokeState(functionName: string, body: Record<string, unknown>) {
      return rememberState(await invoke<PublicDiagnosticState>(functionName, body));
    },
    async refresh(state?: Pick<PublicDiagnosticState, "diagnosticId" | "sessionId">) {
      const stored = state ?? safeRead<StoredDiagnostic>(SESSION_STORAGE_KEY) ?? undefined;
      return rememberState(
        await invoke<PublicDiagnosticState>("diagnostic-state", { ...(stored ?? {}) }),
      );
    },
    async clearSession() {
      if (supabase) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      }
      safeRemove(SESSION_STORAGE_KEY);
      safeRemove(DRAFT_STORAGE_KEY);
    },
  };
}

export function readLocalDraft() {
  return safeRead<LocalDraft>(DRAFT_STORAGE_KEY);
}

export function preserveLocalDraft(draft: LocalDraft) {
  safeWrite(DRAFT_STORAGE_KEY, draft);
}

export function clearLocalDraft() {
  safeRemove(DRAFT_STORAGE_KEY);
}

export function toDiagnosticError(error: unknown): DiagnosticClientError {
  if (error instanceof DiagnosticClientError) return error;
  return new DiagnosticClientError({
    code: "GENERIC_ERROR",
    message: publicErrorMessages.GENERIC_ERROR,
    retryable: true,
  });
}
