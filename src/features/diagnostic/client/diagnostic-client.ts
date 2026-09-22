import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { PublicDiagnosticStateSchema } from "@/features/diagnostic/contracts/public";

import { publicErrorMessages } from "./content";
import { diagnosticPublicConfig, hasDiagnosticBackendConfiguration } from "./config";
import type {
  DiagnosticErrorCode,
  IdentificationDraft,
  IdentificationDraftValues,
  LocalDraft,
  PublicApiError,
  PublicDiagnosticState,
} from "./types";

const SESSION_STORAGE_KEY = "numora.diagnostic.session.v1";
const DRAFT_STORAGE_KEY = "numora.diagnostic.draft.v1";
const IDENTIFICATION_DRAFT_PREFIX = "numora:diagnostic:";
const IDENTIFICATION_DRAFT_SUFFIX = ":identification-draft";
const IDENTIFICATION_DRAFT_VERSION = 1;
const AUTH_REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_FUNCTION_TIMEOUT_MS = 20_000;
const LONG_FUNCTION_TIMEOUT_MS = 45_000;
const LONG_RUNNING_FUNCTIONS = new Set([
  "diagnostic-generate-review",
  "diagnostic-complete",
]);
const POST_IDENTIFICATION_STAGES = new Set<PublicDiagnosticState["stage"]>([
  "CHALLENGE",
  "CURRENT_PROCESS",
  "IMPACT",
  "BUYING_CONTEXT",
  "REVIEW",
  "COMPLETION",
]);
const TERMINAL_DIAGNOSTIC_STATUSES = new Set<PublicDiagnosticState["status"]>([
  "BLOCKED",
  "EXPIRED",
  "COMPLETED",
  "COMPLETED_NO_CONTACT",
]);

const RESTORABLE_TERMINAL_STATUSES = new Set<PublicDiagnosticState["status"]>([
  "BLOCKED",
  "COMPLETED",
  "COMPLETED_NO_CONTACT",
]);

let sharedSupabaseClient: SupabaseClient | null | undefined;
let anonymousSessionPromise: Promise<string> | null = null;

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}) {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  const upstreamSignal = init.signal;

  if (upstreamSignal?.aborted) controller.abort();
  else upstreamSignal?.addEventListener("abort", forwardAbort, { once: true });

  const timeoutId = setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
    upstreamSignal?.removeEventListener("abort", forwardAbort);
  }
}

function getSharedSupabaseClient() {
  if (typeof window === "undefined" || !hasDiagnosticBackendConfiguration()) return null;

  if (sharedSupabaseClient === undefined) {
    sharedSupabaseClient = createClient(
      diagnosticPublicConfig.supabaseUrl,
      diagnosticPublicConfig.supabaseKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
        global: { fetch: fetchWithTimeout },
      },
    );
  }

  return sharedSupabaseClient;
}

type DiagnosticScope = Pick<PublicDiagnosticState, "diagnosticId" | "sessionId">;

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

function identificationDraftKey(scope: DiagnosticScope) {
  return `${IDENTIFICATION_DRAFT_PREFIX}${scope.diagnosticId}:${scope.sessionId}${IDENTIFICATION_DRAFT_SUFFIX}`;
}

function safeSessionRead(key: string): unknown {
  if (typeof window === "undefined") return null;

  try {
    const value = window.sessionStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function safeSessionWrite(key: string, value: unknown) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // O estado React continua disponível quando o storage da aba não está acessível.
  }
}

function safeSessionRemove(key: string) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Sem ação: falhas do storage não devem interromper o diagnóstico.
  }
}

function asIdentificationDraft(value: unknown, scope: DiagnosticScope): IdentificationDraft | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Record<string, unknown>;
  const data = candidate.data;
  if (
    candidate.version !== IDENTIFICATION_DRAFT_VERSION ||
    candidate.diagnosticId !== scope.diagnosticId ||
    candidate.sessionId !== scope.sessionId ||
    typeof candidate.updatedAt !== "string" ||
    Number.isNaN(Date.parse(candidate.updatedAt)) ||
    !data ||
    typeof data !== "object"
  ) {
    return null;
  }

  const fields: ReadonlyArray<keyof IdentificationDraftValues> = [
    "name",
    "role",
    "company",
    "email",
    "industry",
    "industryOther",
    "companySize",
    "phone",
    "revenueRange",
  ];
  const draftData = data as Record<string, unknown>;
  if (fields.some((field) => typeof draftData[field] !== "string")) return null;

  return {
    version: IDENTIFICATION_DRAFT_VERSION,
    diagnosticId: scope.diagnosticId,
    sessionId: scope.sessionId,
    updatedAt: candidate.updatedAt,
    data: Object.fromEntries(fields.map((field) => [field, draftData[field]])) as IdentificationDraftValues,
  };
}

export function readIdentificationDraft(scope: DiagnosticScope) {
  const key = identificationDraftKey(scope);
  const draft = asIdentificationDraft(safeSessionRead(key), scope);
  if (!draft) safeSessionRemove(key);
  return draft;
}

export function preserveIdentificationDraft(
  scope: DiagnosticScope,
  data: IdentificationDraftValues,
) {
  safeSessionWrite(identificationDraftKey(scope), {
    version: IDENTIFICATION_DRAFT_VERSION,
    diagnosticId: scope.diagnosticId,
    sessionId: scope.sessionId,
    updatedAt: new Date().toISOString(),
    data,
  } satisfies IdentificationDraft);
}

export function clearIdentificationDraft(scope?: DiagnosticScope) {
  if (scope) {
    safeSessionRemove(identificationDraftKey(scope));
    return;
  }
  if (typeof window === "undefined") return;

  try {
    const keys = Array.from({ length: window.sessionStorage.length }, (_, index) =>
      window.sessionStorage.key(index),
    ).filter((key): key is string => Boolean(
      key?.startsWith(IDENTIFICATION_DRAFT_PREFIX) && key.endsWith(IDENTIFICATION_DRAFT_SUFFIX),
    ));
    keys.forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // Sem ação: a limpeza volta a ser tentada no próximo ciclo do fluxo.
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
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined") {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export function createDiagnosticClient() {
  const supabaseUrl = diagnosticPublicConfig.supabaseUrl;
  const anonymousKey = diagnosticPublicConfig.supabaseKey;
  const supabase = getSharedSupabaseClient();
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

    if (!anonymousSessionPromise) {
      anonymousSessionPromise = supabase.auth.signInAnonymously()
        .then(({ data, error }) => {
          if (error || !data.session?.access_token) {
            throw new DiagnosticClientError({
              code: "UNAUTHORIZED",
              message: publicErrorMessages.UNAUTHORIZED,
              retryable: true,
            });
          }
          return data.session.access_token;
        })
        .finally(() => {
          anonymousSessionPromise = null;
        });
    }
    return anonymousSessionPromise;
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
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      LONG_RUNNING_FUNCTIONS.has(functionName)
        ? LONG_FUNCTION_TIMEOUT_MS
        : DEFAULT_FUNCTION_TIMEOUT_MS,
    );
    let responseOk = false;
    let responseStatus = 0;
    let responseRowVersionHeader: string | null = null;
    let payload: ApiEnvelope<T> | null = null;

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: "POST",
        headers: {
          apikey: anonymousKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      responseOk = response.ok;
      responseStatus = response.status;
      responseRowVersionHeader = response.headers.get("X-Diagnostic-Row-Version");
      payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new DiagnosticClientError({
          code: "GENERIC_ERROR",
          message: publicErrorMessages.GENERIC_ERROR,
          retryable: true,
        });
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!responseOk || !payload?.data) throw asError(payload, responseStatus);
    const parsed = PublicDiagnosticStateSchema.safeParse(payload.data);
    if (!parsed.success) {
      throw new DiagnosticClientError({
        code: "GENERIC_ERROR",
        message: publicErrorMessages.GENERIC_ERROR,
        retryable: true,
      });
    }
    const responseRowVersion = Number(
      payload.meta?.rowVersion ?? responseRowVersionHeader,
    );
    if (Number.isSafeInteger(responseRowVersion) && responseRowVersion > 0) {
      currentRowVersion = responseRowVersion;
    }
    return parsed.data;
  }

  function rememberState(state: PublicDiagnosticState) {
    safeWrite(SESSION_STORAGE_KEY, {
      diagnosticId: state.diagnosticId,
      sessionId: state.sessionId,
    } satisfies StoredDiagnostic);
    if (
      POST_IDENTIFICATION_STAGES.has(state.stage) ||
      TERMINAL_DIAGNOSTIC_STATUSES.has(state.status)
    ) {
      clearIdentificationDraft(state);
    }
    return state;
  }

  return {
    isConfigured: hasDiagnosticBackendConfiguration(),
    async restoreTerminal() {
      const stored = safeRead<StoredDiagnostic>(SESSION_STORAGE_KEY);
      if (!stored) return null;

      try {
        const state = await invoke<PublicDiagnosticState>("diagnostic-state", stored);
        return RESTORABLE_TERMINAL_STATUSES.has(state.status)
          ? rememberState(state)
          : null;
      } catch (error) {
        if (error instanceof DiagnosticClientError && error.code === "SESSION_NOT_FOUND") {
          return null;
        }
        throw error;
      }
    },
    async findResumable() {
      const stored = safeRead<StoredDiagnostic>(SESSION_STORAGE_KEY);
      try {
        const state = await invoke<PublicDiagnosticState>("diagnostic-state", {
          ...(stored ?? {}),
        });
        if (state.canResume) return rememberState(state);
        clearIdentificationDraft(state);
        return null;
      } catch (error) {
        if (error instanceof DiagnosticClientError && error.code === "SESSION_NOT_FOUND") {
          clearIdentificationDraft();
          return null;
        }
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
        await invoke<PublicDiagnosticState>("diagnostic-state", stored
          ? { diagnosticId: stored.diagnosticId, sessionId: stored.sessionId }
          : {}),
      );
    },
    async clearSession() {
      if (supabase) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      }
      safeRemove(SESSION_STORAGE_KEY);
      safeRemove(DRAFT_STORAGE_KEY);
      clearIdentificationDraft();
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
