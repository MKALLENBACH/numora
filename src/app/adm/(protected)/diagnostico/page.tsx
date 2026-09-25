import { Suspense } from "react";

import { AdminDiagnosticDetail } from "@/features/admin/AdminDiagnosticDetail";

function DetailFallback() {
  return (
    <section className="admin-page" aria-busy="true">
      <div className="admin-list-state">
        <span className="admin-spinner" aria-hidden="true" />
        <p>Carregando diagnóstico…</p>
      </div>
    </section>
  );
}

export default function AdminDiagnosticDetailPage() {
  return (
    <Suspense fallback={<DetailFallback />}>
      <AdminDiagnosticDetail />
    </Suspense>
  );
}
