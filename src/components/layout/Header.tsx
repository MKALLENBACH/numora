"use client";

import { useEffect, useRef, useState } from "react";

import { BrandLogo } from "@/components/ui/BrandLogo";
import { DiagnosticButton } from "@/components/ui/DiagnosticExperience";
import { primaryNavigation } from "@/config/site";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeHref, setActiveHref] = useState<string | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavRef = useRef<HTMLElement>(null);

  const closeMenu = (returnFocus = false) => {
    setMenuOpen(false);
    if (returnFocus) menuButtonRef.current?.focus();
  };

  useEffect(() => {
    if (!menuOpen) return;

    mobileNavRef.current?.querySelector<HTMLElement>("a")?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu(true);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [menuOpen]);

  useEffect(() => {
    const sections = primaryNavigation
      .map((item) => document.querySelector<HTMLElement>(item.href))
      .filter((section): section is HTMLElement => Boolean(section));
    let frame = 0;

    const updateActiveSection = () => {
      frame = 0;
      const marker = Math.min(window.innerHeight * 0.35, 280);
      let current: HTMLElement | null = null;

      for (const section of sections) {
        if (section.getBoundingClientRect().top <= marker) current = section;
      }

      setActiveHref(current ? `#${current.id}` : null);
    };

    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, []);

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <a className="site-header__brand" href="#inicio" aria-label="NUMORA — início">
          <BrandLogo priority />
        </a>

        <nav className="desktop-navigation" aria-label="Navegação principal">
          {primaryNavigation.map((item) => (
            <a
              href={item.href}
              key={item.href}
              data-active={activeHref === item.href}
              aria-current={activeHref === item.href ? "location" : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <DiagnosticButton className="button button--primary header-cta" />

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
        <nav ref={mobileNavRef} className="container" aria-label="Navegação móvel">
          {primaryNavigation.map((item) => (
            <a
              href={item.href}
              key={item.href}
              data-active={activeHref === item.href}
              aria-current={activeHref === item.href ? "location" : undefined}
              onClick={() => closeMenu()}
              tabIndex={menuOpen ? 0 : -1}
            >
              {item.label}
            </a>
          ))}
          <DiagnosticButton
            onActivate={() => closeMenu()}
            getReturnFocus={() => menuButtonRef.current}
            tabIndex={menuOpen ? 0 : -1}
          />
        </nav>
      </div>
    </header>
  );
}
