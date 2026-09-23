import { z } from "zod";

import { withBasePath } from "@/config/runtime";
import { getAdminSupabaseBrowserClient } from "@/lib/supabase/browser";

import {
  ADMIN_FUNCTION_TIMEOUT_MS,
  AdminClientError,
  adminConfigurationError,
  adminFunctionFetch,
  adminSupabaseConfiguration,
  currentAdminAccessToken,
} from "./admin-transport";
import { adminRoles, type AdminSession } from "./types";

const AdminSessionSchema = z.object({
  userId: z.uuid(),
  profileId: z.uuid(),
  displayName: z.string().min(2).max(150),
  email: z.email(),
  role: z.enum(adminRoles),
  isActive: z.literal(true),
}).strict();

type AdminAction = "SESSION" | "LOGIN" | "LOGOUT";

export { AdminClientError } from "./admin-transport";

async function invokeAdminAuth(
  action: AdminAction,
  accessToken: string,
): Promise<AdminSession> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ADMIN_FUNCTION_TIMEOUT_MS);

  try {
    const response = await adminFunctionFetch({
      functionName: "admin-auth",
      accessToken,
      body: { action },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null) as {
      data?: unknown;
      error?: { code?: string; message?: string } | null;
    } | null;

    if (!response.ok || !payload?.data) {
      const code = payload?.error?.code === "ACCESS_DENIED"
        ? "ACCESS_DENIED"
        : payload?.error?.code === "UNAUTHORIZED"
          ? "UNAUTHORIZED"
          : "GENERIC_ERROR";
      throw new AdminClientError(
        code,
        code === "ACCESS_DENIED"
          ? "Sua conta não possui acesso autorizado ao ADM."
          : "Não foi possível validar sua sessão.",
      );
    }

    const parsed = AdminSessionSchema.safeParse(payload.data);
    if (!parsed.success) {
      throw new AdminClientError("GENERIC_ERROR", "Não foi possível validar sua sessão.");
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof AdminClientError) throw error;
    throw new AdminClientError(
      "GENERIC_ERROR",
      controller.signal.aborted
        ? "A validação da sessão demorou mais do que o esperado. Tente novamente."
        : "Não foi possível validar sua sessão.",
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export function safeAdminReturnTo(rawValue: string | null) {
  const fallback = withBasePath("/adm/");
  if (!rawValue || typeof window === "undefined") return fallback;
  try {
    const decoded = decodeURIComponent(rawValue);
    if (decoded.includes("\\")) return fallback;
    const candidate = new URL(decoded, window.location.origin);
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim().replace(/\/$/, "") || "";
    const admRoot = `${basePath}/adm`;
    const publicAuthRoutes = new Set([
      `${admRoot}/login`,
      `${admRoot}/login/`,
      `${admRoot}/recuperar-acesso`,
      `${admRoot}/recuperar-acesso/`,
    ]);
    if (
      candidate.origin !== window.location.origin ||
      candidate.username ||
      candidate.password ||
      (candidate.pathname !== admRoot && !candidate.pathname.startsWith(`${admRoot}/`)) ||
      publicAuthRoutes.has(candidate.pathname)
    ) {
      return fallback;
    }
    return `${candidate.pathname}${candidate.search}${candidate.hash}`;
  } catch {
    return fallback;
  }
}

export const adminClient = {
  async restore() {
    return invokeAdminAuth("SESSION", await currentAdminAccessToken());
  },

  async login(email: string, password: string) {
    const supabase = getAdminSupabaseBrowserClient();
    if (!supabase) throw adminConfigurationError();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session?.access_token || data.user.is_anonymous) {
      throw new AdminClientError(
        "UNAUTHORIZED",
        "Não foi possível acessar. Verifique suas credenciais e tente novamente.",
      );
    }

    try {
      return await invokeAdminAuth("LOGIN", data.session.access_token);
    } catch (authorizationError) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      throw authorizationError;
    }
  },

  async logout() {
    const supabase = getAdminSupabaseBrowserClient();
    if (!supabase) throw adminConfigurationError();
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        await invokeAdminAuth("LOGOUT", data.session.access_token);
      }
    } catch {
      // O encerramento local continua mesmo se a auditoria remota estiver indisponível.
    } finally {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
        }
      } catch {
        await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      }
    }
  },

  async requestRecovery(email: string) {
    adminSupabaseConfiguration();
    const redirectTo = `${window.location.origin}${withBasePath("/adm/recuperar-acesso/")}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ADMIN_FUNCTION_TIMEOUT_MS);
    try {
      const response = await adminFunctionFetch({
        functionName: "admin-auth",
        body: { action: "RECOVER", email, redirectTo },
        signal: controller.signal,
      });
      if (response.ok) return;
    } catch {
      // A mensagem pública permanece neutra e não revela o estado da conta.
    } finally {
      clearTimeout(timeoutId);
    }

    throw new AdminClientError(
      "GENERIC_ERROR",
      "Não foi possível enviar as instruções neste momento. Tente novamente.",
    );
  },

  async updatePassword(password: string) {
    const supabase = getAdminSupabaseBrowserClient();
    if (!supabase) throw adminConfigurationError();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      throw new AdminClientError(
        "GENERIC_ERROR",
        "Não foi possível atualizar sua senha. Solicite novas instruções e tente novamente.",
      );
    }
  },
};
