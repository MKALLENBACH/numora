"use client";

import { useAdminAuth } from "./AdminAuthProvider";
import { adminRoleLabels } from "./types";

export function AdminProfile() {
  const { session } = useAdminAuth();

  return (
    <section className="admin-page" aria-labelledby="admin-profile-title">
      <p className="admin-eyebrow">Conta interna</p>
      <h1 id="admin-profile-title">Perfil</h1>
      <p className="admin-page__lead">Informações de acesso mantidas pela administração da NUMORA.</p>
      <dl className="admin-profile-list">
        <div><dt>Nome interno</dt><dd>{session?.displayName}</dd></div>
        <div><dt>E-mail</dt><dd>{session?.email}</dd></div>
        <div><dt>Perfil de acesso</dt><dd>{session ? adminRoleLabels[session.role] : ""}</dd></div>
        <div><dt>Status</dt><dd><span className="admin-status-pill">Ativo</span></dd></div>
      </dl>
      <p className="admin-profile-note">Alterações de perfil e permissões são realizadas somente por operações administrativas seguras.</p>
    </section>
  );
}
