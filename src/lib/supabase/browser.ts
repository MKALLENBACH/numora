import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const AUTH_REQUEST_TIMEOUT_MS = 20_000;

let diagnosticBrowserClient: SupabaseClient | null | undefined;
let adminBrowserClient: SupabaseClient | null | undefined;

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}) {
  const controller = new AbortController();
  const upstreamSignal = init.signal;
  const forwardAbort = () => controller.abort();

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

function browserConfiguration() {
  if (typeof window === "undefined") return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "") ?? "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!supabaseUrl || !supabaseKey) return null;

  return { supabaseUrl, supabaseKey };
}

export function getDiagnosticSupabaseBrowserClient() {
  const configuration = browserConfiguration();
  if (!configuration) return null;

  if (diagnosticBrowserClient === undefined) {
    diagnosticBrowserClient = createClient(
      configuration.supabaseUrl,
      configuration.supabaseKey,
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

  return diagnosticBrowserClient;
}

export function getAdminSupabaseBrowserClient() {
  const configuration = browserConfiguration();
  if (!configuration) return null;

  if (adminBrowserClient === undefined) {
    adminBrowserClient = createClient(
      configuration.supabaseUrl,
      configuration.supabaseKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "numora.admin.auth.v1",
        },
        global: { fetch: fetchWithTimeout },
      },
    );
  }

  return adminBrowserClient;
}
