"use client";

import { type FormEvent, useEffect, useState } from "react";

import { BrandLogo } from "@/components/ui/BrandLogo";
import { withBasePath } from "@/config/runtime";
import { getAdminSupabaseBrowserClient } from "@/lib/supabase/browser";

import { adminClient, AdminClientError } from "./admin-client";

export function AdminRecovery() {
  const [resetMode, setResetMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const recoveryHint = window.location.hash.includes("type=recovery") ||
      new URLSearchParams(window.location.search).has("code");
    const hintTimer = window.setTimeout(() => {
      if (recoveryHint) setResetMode(true);
    }, 0);

    const subscription = getAdminSupabaseBrowserClient()?.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setResetMode(true);
    }).data.subscription;
    return () => {
      window.clearTimeout(hintTimer);
      subscription?.unsubscribe();
    };
  }, []);

  async function requestRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await adminClient.requestRecovery(String(form.get("email") ?? "").trim());
      setMessage("Se existir uma conta elegível para esse endereço, as instruções de recuperação serão enviadas.");
      formElement.reset();
    } catch (requestError) {
      setError(requestError instanceof AdminClientError
        ? requestError.message
        : "Não foi possível enviar as instruções neste momento. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (password !== confirmation) {
      setError("As senhas informadas não coincidem.");
      setBusy(false);
      return;
    }
    try {
      await adminClient.updatePassword(password);
      await adminClient.logout();
      window.location.replace(`${withBasePath("/adm/login/")}?recovered=1`);
    } catch (updateError) {
      setError(updateError instanceof AdminClientError
        ? updateError.message
        : "Não foi possível atualizar sua senha.");
      setBusy(false);
    }
  }

  return (
    <main className="admin-auth-screen">
      <section className="admin-auth-card" aria-labelledby="admin-recovery-title">
        <a className="admin-auth-brand" href={withBasePath("/")} aria-label="NUMORA — voltar ao site">
          <BrandLogo priority />
        </a>
        <p className="admin-eyebrow">Área interna</p>
        <h1 id="admin-recovery-title">{resetMode ? "Defina uma nova senha" : "Recuperar acesso"}</h1>
        <p className="admin-auth-description">
          {resetMode
            ? "Crie uma nova senha para sua conta interna."
            : "Informe seu e-mail interno para receber as instruções de recuperação."}
        </p>
        {message ? <p className="admin-notice" role="status">{message}</p> : null}
        {error ? <p className="admin-error" role="alert">{error}</p> : null}

        {resetMode ? (
          <form className="admin-form" onSubmit={updatePassword}>
            <div>
              <label htmlFor="new-password">Nova senha</label>
              <input id="new-password" name="password" type="password" autoComplete="new-password" minLength={12} required />
            </div>
            <div>
              <label htmlFor="new-password-confirmation">Confirmar nova senha</label>
              <input id="new-password-confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={12} required />
            </div>
            <button className="admin-primary-button" type="submit" disabled={busy}>
              {busy ? "Atualizando…" : "Atualizar senha"}
            </button>
          </form>
        ) : (
          <form className="admin-form" onSubmit={requestRecovery}>
            <div>
              <label htmlFor="recovery-email">E-mail</label>
              <input id="recovery-email" name="email" type="email" autoComplete="email" maxLength={320} required />
            </div>
            <button className="admin-primary-button" type="submit" disabled={busy}>
              {busy ? "Enviando…" : "Enviar instruções"}
            </button>
          </form>
        )}
        <a className="admin-text-link" href={withBasePath("/adm/login/")}>Voltar ao login</a>
      </section>
    </main>
  );
}
