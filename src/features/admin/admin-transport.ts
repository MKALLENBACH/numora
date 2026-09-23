import { getAdminSupabaseBrowserClient } from "@/lib/supabase/browser";

export const ADMIN_FUNCTION_TIMEOUT_MS = 20_000;

export type AdminErrorCode =
  | "UNAUTHORIZED"
  | "ACCESS_DENIED"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "QUERY_TIMEOUT"
  | "CONFIGURATION_ERROR"
  | "GENERIC_ERROR";

export class AdminClientError extends Error {
  constructor(
    public readonly code: AdminErrorCode,
    message: string,
    public readonly referenceCode?: string,
  ) {
    super(message);
  }
}

export function adminConfigurationError() {
  return new AdminClientError(
    "CONFIGURATION_ERROR",
    "O ADM não está configurado neste ambiente.",
  );
}

export function adminSupabaseConfiguration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "") ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url || !key) throw adminConfigurationError();
  return { url, key };
}

export async function currentAdminAccessToken() {
  const supabase = getAdminSupabaseBrowserClient();
  if (!supabase) throw adminConfigurationError();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new AdminClientError("UNAUTHORIZED", "Não foi possível validar sua sessão.");
  }
  return data.session.access_token;
}

export async function adminFunctionFetch(input: {
  functionName: string;
  accessToken?: string;
  body: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}) {
  const { url, key } = adminSupabaseConfiguration();
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(input.signal?.reason);
  if (input.signal?.aborted) controller.abort(input.signal.reason);
  else input.signal?.addEventListener("abort", forwardAbort, { once: true });

  const timeoutId = window.setTimeout(
    () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
    input.timeoutMs ?? ADMIN_FUNCTION_TIMEOUT_MS,
  );
  try {
    return await fetch(`${url}/functions/v1/${input.functionName}`, {
      method: "POST",
      headers: {
        apikey: key,
        ...(input.accessToken ? { Authorization: `Bearer ${input.accessToken}` } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input.body),
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    window.clearTimeout(timeoutId);
    input.signal?.removeEventListener("abort", forwardAbort);
  }
}
