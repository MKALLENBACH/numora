"use client";

import { type FormEvent, useEffect, useState } from "react";

import { BrandLogo } from "@/components/ui/BrandLogo";
import { withBasePath } from "@/config/runtime";

import { AdminClientError, safeAdminReturnTo } from "./admin-client";
import { useAdminAuth } from "./AdminAuthProvider";

export function AdminLogin() {
  const { status, login, message, clearMessage } = useAdminAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const timer = window.setTimeout(() => {
      if (params.get("recovered") === "1") {
        setNotice("Senha atualizada. Entre com sua nova senha.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      const params = new URLSearchParams(window.location.search);
      window.location.replace(safeAdminReturnTo(params.get("returnTo")));
    }
  }, [status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    clearMessage();
    const form = new FormData(event.currentTarget);

    try {
      await login(String(form.get("email") ?? "").trim(), String(form.get("password") ?? ""));
      const params = new URLSearchParams(window.location.search);
      window.location.replace(safeAdminReturnTo(params.get("returnTo")));
    } catch (loginError) {
      setError(loginError instanceof AdminClientError
        ? loginError.message
        : "Não foi possível acessar. Verifique suas credenciais e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-auth-screen">
      <section className="admin-auth-card" aria-labelledby="admin-login-title">
        <a className="admin-auth-brand" href={withBasePath("/")} aria-label="NUMORA — voltar ao site">
          <BrandLogo priority />
        </a>
        <p className="admin-eyebrow">Área interna</p>
        <h1 id="admin-login-title">Acesse o ADM da NUMORA</h1>
        <p className="admin-auth-description">
          Entre com sua conta interna para analisar diagnósticos e acompanhar o fluxo de avaliação.
        </p>
        {notice ? <p className="admin-notice" role="status">{notice}</p> : null}
        {error || message ? <p className="admin-error" role="alert">{error ?? message}</p> : null}
        <form className="admin-form" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="admin-email">E-mail</label>
            <input id="admin-email" name="email" type="email" autoComplete="username" required maxLength={320} />
          </div>
          <div>
            <label htmlFor="admin-password">Senha</label>
            <input id="admin-password" name="password" type="password" autoComplete="current-password" required minLength={8} />
          </div>
          <button className="admin-primary-button" type="submit" disabled={busy || status === "loading"}>
            {busy ? "Validando…" : "Entrar"}
          </button>
        </form>
        <a className="admin-text-link" href={withBasePath("/adm/recuperar-acesso/")}>Esqueci minha senha</a>
        <p className="admin-restricted-copy">Esta área é restrita à equipe autorizada da NUMORA.</p>
      </section>
    </main>
  );
}
