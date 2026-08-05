"use client";

import { useEffect, useRef, useState } from "react";

import { BrandLogo } from "@/components/ui/BrandLogo";
import { useDiagnostic } from "@/components/ui/DiagnosticExperience";
import { diagnosticConfig } from "@/config/diagnostic";
import { primaryNavigation } from "@/config/site";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { openDiagnostic } = useDiagnostic();

  const closeMenu = (returnFocus = false) => {
    setMenuOpen(false);
    if (returnFocus) menuButtonRef.current?.focus();
  };

  useEffect(() => {
    if (!menuOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu(true);
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  const handleMobileDiagnostic = () => {
    const returnTarget = menuButtonRef.current;
    setMenuOpen(false);
    openDiagnostic(returnTarget);
  };

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <a className="site-header__brand" href="#inicio" aria-label="NUMORA — início">
          <BrandLogo priority />
        </a>

        <nav className="desktop-navigation" aria-label="Navegação principal">
          {primaryNavigation.map((item) => (
            <a href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <button
          className="button button--primary header-cta"
          type="button"
          onClick={(event) => openDiagnostic(event.currentTarget)}
        >
          {diagnosticConfig.label}
        </button>

        <button
          ref={menuButtonRef}
          className="menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          onClick={() => setMenuOpen((current) => !current)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>

      <div
        className="mobile-navigation"
        id="mobile-navigation"
        data-open={menuOpen}
        aria-hidden={!menuOpen}
      >
        <nav className="container" aria-label="Navegação móvel">
          {primaryNavigation.map((item) => (
            <a href={item.href} key={item.href} onClick={() => closeMenu()} tabIndex={menuOpen ? 0 : -1}>
              {item.label}
            </a>
          ))}
          <button
            className="button button--primary"
            type="button"
            onClick={handleMobileDiagnostic}
            tabIndex={menuOpen ? 0 : -1}
          >
            {diagnosticConfig.label}
          </button>
        </nav>
      </div>
    </header>
  );
}
