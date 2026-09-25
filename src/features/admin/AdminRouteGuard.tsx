"use client";

import { useEffect } from "react";

import { withBasePath } from "@/config/runtime";

import { useAdminAuth } from "./AdminAuthProvider";
import { currentProtectedAdminReturnTo } from "./diagnostic-detail-navigation";

export function AdminRouteGuard({ children }: Readonly<{ children: React.ReactNode }>) {
  const { status } = useAdminAuth();

  useEffect(() => {
    if (status !== "anonymous" && status !== "denied") return;
    const returnTo = encodeURIComponent(currentProtectedAdminReturnTo());
    window.location.replace(`${withBasePath("/adm/login/")}?returnTo=${returnTo}`);
  }, [status]);

  if (status !== "authenticated") {
    return (
      <main className="admin-auth-screen" aria-busy="true">
        <section className="admin-auth-card admin-auth-card--loading" aria-live="polite">
          <p className="admin-eyebrow">Área interna</p>
          <h1>Validando acesso…</h1>
          <p>Aguarde enquanto sua sessão é verificada com segurança.</p>
        </section>
      </main>
    );
  }

  return children;
}
