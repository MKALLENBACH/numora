import type { ReactNode } from "react";

import { BrandLogo } from "@/components/ui/BrandLogo";
import { siteConfig } from "@/config/site";

type DiagnosticShellProps = {
  children: ReactNode;
  aside?: ReactNode;
  modalOpen?: boolean;
};

export function DiagnosticHeader({ inert = false }: { inert?: boolean }) {
  return (
    <header className="diagnostic-header" inert={inert || undefined}>
      <div className="diagnostic-header__inner">
        <a className="diagnostic-header__brand" href={`${siteConfig.basePath}/`} aria-label="NUMORA — início">
          <BrandLogo priority />
        </a>
        <span className="diagnostic-header__context">Diagnóstico inicial</span>
      </div>
    </header>
  );
}

export function DiagnosticShell({ children, aside, modalOpen = false }: DiagnosticShellProps) {
  return (
    <div className="diagnostic-app">
      <a className="diagnostic-skip-link" href="#conteudo-diagnostico" inert={modalOpen || undefined}>
        Ir para o conteúdo
      </a>
      <DiagnosticHeader inert={modalOpen} />
      {aside}
      <main className="diagnostic-main" id="conteudo-diagnostico" tabIndex={-1}>
        <div className="diagnostic-main__inner">{children}</div>
      </main>
      <footer className="diagnostic-footer" inert={modalOpen || undefined}>
        <p>Suas informações são tratadas com cuidado e usadas apenas para as finalidades autorizadas.</p>
      </footer>
    </div>
  );
}
