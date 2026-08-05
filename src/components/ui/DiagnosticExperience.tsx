"use client";

import {
  createContext,
  type MouseEvent,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
} from "react";

import { diagnosticConfig } from "@/config/diagnostic";

type DiagnosticContextValue = {
  openDiagnostic: (opener?: HTMLElement | null) => void;
};

const DiagnosticContext = createContext<DiagnosticContextValue | null>(null);

export function useDiagnostic() {
  const context = useContext(DiagnosticContext);

  if (!context) {
    throw new Error("useDiagnostic deve ser usado dentro de DiagnosticProvider.");
  }

  return context;
}

export function DiagnosticProvider({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const openDiagnostic = (opener?: HTMLElement | null) => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    openerRef.current = opener ?? (document.activeElement as HTMLElement | null);
    if (!dialog.open) dialog.showModal();
  };

  const closeDialog = () => dialogRef.current?.close();

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) closeDialog();
  };

  const restoreFocus = () => {
    const opener = openerRef.current;
    openerRef.current = null;
    if (opener?.isConnected) opener.focus();
  };

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !dialogRef.current?.open) return;
      event.preventDefault();
      dialogRef.current.close();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  return (
    <DiagnosticContext.Provider value={{ openDiagnostic }}>
      {children}
      {!diagnosticConfig.enabled ? (
        <dialog
          ref={dialogRef}
          className="diagnostic-dialog"
          aria-labelledby="diagnostic-dialog-title"
          aria-describedby="diagnostic-dialog-description"
          onClick={handleBackdropClick}
          onCancel={(event) => {
            event.preventDefault();
            closeDialog();
          }}
          onClose={restoreFocus}
        >
          <div className="diagnostic-dialog__inner">
            <h2 id="diagnostic-dialog-title">{diagnosticConfig.dialog.title}</h2>
            <p id="diagnostic-dialog-description">{diagnosticConfig.dialog.description}</p>
            <button className="button button--primary" type="button" onClick={closeDialog}>
              {diagnosticConfig.dialog.closeLabel}
            </button>
          </div>
        </dialog>
      ) : null}
    </DiagnosticContext.Provider>
  );
}

type DiagnosticButtonProps = {
  className?: string;
  children?: ReactNode;
  onActivate?: () => void;
  getReturnFocus?: () => HTMLElement | null;
  tabIndex?: number;
};

export function DiagnosticButton({
  className = "button button--primary",
  children = diagnosticConfig.label,
  onActivate,
  getReturnFocus,
  tabIndex,
}: DiagnosticButtonProps) {
  const { openDiagnostic } = useDiagnostic();

  if (diagnosticConfig.enabled) {
    return (
      <a className={className} href={diagnosticConfig.href} onClick={onActivate} tabIndex={tabIndex}>
        {children}
      </a>
    );
  }

  return (
    <button
      className={className}
      type="button"
      tabIndex={tabIndex}
      onClick={(event) => {
        const returnFocus = getReturnFocus?.() ?? event.currentTarget;
        onActivate?.();
        openDiagnostic(returnFocus);
      }}
    >
      {children}
    </button>
  );
}
