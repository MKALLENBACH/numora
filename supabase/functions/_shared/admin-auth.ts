import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export const ADMIN_ROLES = ["ADMIN", "CONSULTANT", "VIEWER"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export type AdminUserContext = {
  userId: string;
  profileId: string;
  displayName: string;
  role: AdminRole;
  isActive: true;
};

export class AdminAuthError extends Error {
  constructor(
    public readonly code: "UNAUTHORIZED" | "ACCESS_DENIED" | "CONFIGURATION_ERROR" | "INTERNAL_ERROR",
    public readonly status: number,
    public readonly reasonCode: string,
    public readonly actorUserId?: string,
    public readonly profileId?: string,
  ) {
    super(code);
  }
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new AdminAuthError("CONFIGURATION_ERROR", 500, "MISSING_SERVER_CONFIGURATION");
  return value;
}

export function createAdminServiceClient(): SupabaseClient {
  return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && ADMIN_ROLES.includes(value as AdminRole);
}

export async function requireAdminUser(request: Request): Promise<{
  context: AdminUserContext;
  email: string;
  admin: SupabaseClient;
  user: User;
}> {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new AdminAuthError("UNAUTHORIZED", 401, "MISSING_BEARER_TOKEN");

  const url = requiredEnv("SUPABASE_URL");
  const anonKey = requiredEnv("SUPABASE_ANON_KEY");
  const token = match[1];
  const userClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) {
    throw new AdminAuthError("UNAUTHORIZED", 401, "INVALID_OR_EXPIRED_TOKEN");
  }

  const user = data.user;
  if (user.is_anonymous === true) {
    throw new AdminAuthError("ACCESS_DENIED", 403, "ANONYMOUS_USER", user.id);
  }

  const admin = createAdminServiceClient();
  const { data: profile, error: profileError } = await admin
    .from("admin_profiles")
    .select("id,user_id,display_name,role,is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new AdminAuthError("INTERNAL_ERROR", 500, "PROFILE_LOOKUP_FAILED", user.id);
  }
  if (!profile) {
    throw new AdminAuthError("ACCESS_DENIED", 403, "PROFILE_NOT_FOUND", user.id);
  }
  if (profile.is_active !== true) {
    throw new AdminAuthError("ACCESS_DENIED", 403, "PROFILE_INACTIVE", user.id, profile.id);
  }
  if (!isAdminRole(profile.role)) {
    throw new AdminAuthError("ACCESS_DENIED", 403, "INVALID_ROLE", user.id, profile.id);
  }

  return {
    context: {
      userId: user.id,
      profileId: profile.id,
      displayName: profile.display_name,
      role: profile.role,
      isActive: true,
    },
    email: user.email ?? "",
    admin,
    user,
  };
}

export function requireRole(context: AdminUserContext, allowedRoles: readonly AdminRole[]) {
  if (!allowedRoles.includes(context.role)) {
    throw new AdminAuthError(
      "ACCESS_DENIED",
      403,
      "ROLE_NOT_ALLOWED",
      context.userId,
      context.profileId,
    );
  }
  return context;
}

export async function writeAdminAuditEvent(
  admin: SupabaseClient,
  event: {
    actorUserId?: string;
    profileId?: string;
    eventType: "ADMIN_LOGIN" | "ADMIN_LOGOUT" | "ADMIN_ACCESS_DENIED" | "PASSWORD_RECOVERY_REQUESTED";
    succeeded: boolean;
    reasonCode?: string;
  },
) {
  const { error } = await admin.from("admin_audit_events").insert({
    actor_user_id: event.actorUserId ?? null,
    profile_id: event.profileId ?? null,
    event_type: event.eventType,
    succeeded: event.succeeded,
    reason_code: event.reasonCode ?? null,
  });
  if (error) console.error("Admin audit event could not be recorded.");
}
