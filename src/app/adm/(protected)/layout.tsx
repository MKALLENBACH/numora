import { AdminRouteGuard } from "@/features/admin/AdminRouteGuard";
import { AdminShell } from "@/features/admin/AdminShell";

export default function ProtectedAdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AdminRouteGuard>
      <AdminShell>{children}</AdminShell>
    </AdminRouteGuard>
  );
}
