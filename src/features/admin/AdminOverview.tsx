"use client";

import { useAdminAuth } from "./AdminAuthProvider";
import { adminRoleLabels } from "./types";

export function AdminOverview() {
  const { session } = useAdminAuth();

  return (
    <section className="admin-page" aria-labelledby="admin-overview-title">
      <p className="admin-eyebrow">Área interna</p>
      <h1 id="admin-overview-title">ADM NUMORA</h1>
      <p className="admin-page__lead">
        A estrutura interna está pronta para receber os módulos de análise dos diagnósticos.
      </p>
      <div className="admin-status-card">
        <div>
          <span>Usuário</span>
          <strong>{session?.displayName}</strong>
        </div>
        <div>
          <span>Perfil</span>
          <strong>{session ? adminRoleLabels[session.role] : ""}</strong>
        </div>
        <div>
          <span>Sessão</span>
          <strong className="admin-active-status"><i aria-hidden="true" /> Ativa e validada</strong>
        </div>
      </div>
    </section>
  );
}
