"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";

import { siteConfig } from "@/config/site";
import type { DiagnosticClientError } from "@/features/diagnostic/client/diagnostic-client";
import type { PreviousAnswer, ReviewSection } from "@/features/diagnostic/client/types";

function ModalDialog({
  title,
  description,
  children,
  onClose,
  variant = "dialog",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose?: () => void;
  variant?: "dialog" | "drawer";
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>(
      "button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
    );
    focusable?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && onClose) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(
          "button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [onClose]);

  return (
    <div className={`diagnostic-overlay diagnostic-overlay--${variant}`}>
      <button className="diagnostic-overlay__dismiss" type="button" aria-label="Fechar" onClick={onClose} disabled={!onClose} />
      <div
        className={`diagnostic-dialog diagnostic-dialog--${variant}`}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <div className="diagnostic-dialog__header">
          <div>
            <p className="diagnostic-eyebrow">NUMORA</p>
            <h2 id={titleId}>{title}</h2>
          </div>
          {onClose ? (
            <button className="diagnostic-icon-button" type="button" onClick={onClose} aria-label="Fechar janela">×</button>
          ) : null}
        </div>
        {description ? <p className="diagnostic-dialog__description" id={descriptionId}>{description}</p> : null}
        {children}
      </div>
    </div>
  );
}

export function ResumeDialog({
  onContinue,
  onRestart,
  onClose,
  busy,
}: {
  onContinue: () => void;
  onRestart: () => void | Promise<void>;
  onClose: () => void;
  busy: boolean;
}) {
  return (
    <ModalDialog
      title="Continue seu diagnóstico"
      description="Encontramos um diagnóstico em andamento neste navegador. Você pode continuar de onde parou ou iniciar novamente."
      onClose={onClose}
    >
      <div className="diagnostic-dialog__actions">
        <button className="diagnostic-button diagnostic-button--primary" type="button" onClick={onContinue} disabled={busy}>Continuar diagnóstico</button>
        <button className="diagnostic-button diagnostic-button--secondary" type="button" onClick={onRestart} disabled={busy}>{busy ? "Aguarde…" : "Iniciar novamente"}</button>
        <a className="diagnostic-text-link" href={`${siteConfig.basePath}/`}>Voltar ao site</a>
      </div>
      <p className="diagnostic-dialog__note">A retomada fica disponível neste navegador enquanto a sessão anônima estiver válida.</p>
    </ModalDialog>
  );
}

export function PreviousAnswersDrawer({ answers, onClose }: { answers: ReadonlyArray<PreviousAnswer>; onClose: () => void }) {
  return (
    <ModalDialog title="Respostas anteriores" description="Consulte o que já foi registrado nesta entrevista." onClose={onClose} variant="drawer">
      {answers.length ? (
        <ol className="diagnostic-previous-list">
          {answers.map((answer) => (
            <li key={answer.questionCode}>
              <h3>{answer.question}</h3>
              <p>{answer.displayValue}</p>
            </li>
          ))}
        </ol>
      ) : <p className="diagnostic-dialog__description">Ainda não há respostas anteriores.</p>}
    </ModalDialog>
  );
}

export function EditReviewDialog({
  section,
  onSave,
  onClose,
  busy,
}: {
  section: ReviewSection;
  onSave: (value: string) => void | Promise<void>;
  onClose: () => void;
  busy: boolean;
}) {
  const [value, setValue] = useState(section.value);

  return (
    <ModalDialog title={`Editar ${section.title}`} description="Atualize somente este bloco. O resumo será gerado novamente." onClose={onClose}>
      <div className="diagnostic-field">
        <label htmlFor="review-edit-value">Informação revisada</label>
        <textarea id="review-edit-value" value={value} onChange={(event) => setValue(event.target.value)} rows={6} maxLength={2000} />
      </div>
      <div className="diagnostic-dialog__actions diagnostic-dialog__actions--row">
        <button className="diagnostic-button diagnostic-button--secondary" type="button" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="diagnostic-button diagnostic-button--primary" type="button" onClick={() => onSave(value.trim())} disabled={busy || !value.trim()}>{busy ? "Salvando…" : "Salvar alteração"}</button>
      </div>
    </ModalDialog>
  );
}

export function DiagnosticErrorState({
  error,
  onRetry,
  onRestart,
}: {
  error: DiagnosticClientError;
  onRetry?: () => void | Promise<void>;
  onRestart?: () => void | Promise<void>;
}) {
  const critical = ["CONFIGURATION_ERROR", "SESSION_EXPIRED", "PERSISTENCE_UNAVAILABLE", "UNAUTHORIZED"].includes(error.code);
  const heading = error.code === "CONFIGURATION_ERROR"
    ? "Diagnóstico indisponível neste ambiente"
    : "Suas informações foram preservadas";

  return (
    <section className="diagnostic-card diagnostic-card--error" aria-labelledby="diagnostic-error-title" role={critical ? "alert" : "status"}>
      <p className="diagnostic-eyebrow">Não foi possível avançar</p>
      <h1 id="diagnostic-error-title">{heading}</h1>
      <p className="diagnostic-lead">{error.message}</p>
      {error.referenceCode ? <p className="diagnostic-reference">Código de referência: {error.referenceCode}</p> : null}
      <div className="diagnostic-actions">
        {onRestart && ["SESSION_EXPIRED", "UNAUTHORIZED"].includes(error.code) ? (
          <button className="diagnostic-button diagnostic-button--secondary" type="button" onClick={onRestart}>Iniciar novo diagnóstico</button>
        ) : null}
        {onRetry && error.retryable ? (
          <button className="diagnostic-button diagnostic-button--primary" type="button" onClick={onRetry}>Tentar novamente</button>
        ) : null}
        <a className="diagnostic-button diagnostic-button--secondary" href={`${siteConfig.basePath}/`}>Voltar ao site</a>
      </div>
    </section>
  );
}
