export const adminRoles = ["ADMIN", "CONSULTANT", "VIEWER"] as const;
export type AdminRole = (typeof adminRoles)[number];

export type AdminSession = {
  userId: string;
  profileId: string;
  displayName: string;
  email: string;
  role: AdminRole;
  isActive: true;
};

export type AdminAuthStatus = "loading" | "anonymous" | "authenticated" | "denied";

export const adminRoleLabels: Record<AdminRole, string> = {
  ADMIN: "Administrador",
  CONSULTANT: "Consultor",
  VIEWER: "Visualizador",
};
