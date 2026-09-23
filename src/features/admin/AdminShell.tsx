"use client";

import { usePathname } from "next/navigation";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import { BrandLogo } from "@/components/ui/BrandLogo";
import { withBasePath } from "@/config/runtime";

import { useAdminAuth } from "./AdminAuthProvider";
import { adminRoleLabels } from "./types";

const navigation = [
  { label: "Visão geral", href: "/adm/" },
  { label: "Diagnósticos", href: "/adm/diagnosticos/" },
  { label: "Perfil", href: "/adm/perfil/" },
] as const;

export function AdminShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const { session, logout } = useAdminAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerWasOpenRef = useRef(false);

  useEffect(() => {
    if (menuOpen) {
      drawerWasOpenRef.current = true;
      closeButtonRef.current?.focus();
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
    if (drawerWasOpenRef.current) {
      drawerWasOpenRef.current = false;
      menuButtonRef.current?.focus();
    }
  }, [menuOpen]);

  function handleDrawerKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setMenuOpen(false);
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"),
    );
    const first = focusable.at(0);
    const last = focusable.at(-1);
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function handleLogout() {
    if (leaving) return;
    setLeaving(true);
    await logout();
    window.location.replace(withBasePath("/adm/login/"));
  }

  const nav = (
    <>
      <nav className="admin-nav" aria-label="Navegação do ADM">
        {navigation.map((item) => {
          const href = withBasePath(item.href);
          const normalizedHref = href.replace(/\/$/, "");
          const current = pathname === href || pathname === normalizedHref || (
            item.href !== "/adm/" && pathname.startsWith(`${normalizedHref}/`)
          );
          return (
            <a
              key={item.href}
              href={href}
              aria-current={current ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </a>
          );
        })}
      </nav>
      <button className="admin-logout" type="button" onClick={handleLogout} disabled={leaving}>
        {leaving ? "Saindo…" : "Sair"}
      </button>
    </>
  );

  return (
    <div className="admin-app">
      <a className="admin-skip-link" href="#admin-content">Ir para o conteúdo</a>
      <aside className="admin-sidebar">
        <a className="admin-brand" href={withBasePath("/adm/")} aria-label="NUMORA ADM — início">
          <BrandLogo priority />
        </a>
        <p className="admin-sidebar__label">Administração</p>
        {nav}
      </aside>

      <div className="admin-workspace">
        <header className="admin-header">
          <button
            ref={menuButtonRef}
            className="admin-menu-button"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="admin-mobile-drawer"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span aria-hidden="true">☰</span>
            Menu
          </button>
          <div className="admin-header__identity">
            <span>{session?.displayName}</span>
            <small>{session ? adminRoleLabels[session.role] : ""}</small>
          </div>
        </header>

        {menuOpen ? (
          <div className="admin-drawer-backdrop" role="presentation" onClick={() => setMenuOpen(false)}>
            <aside
              id="admin-mobile-drawer"
              className="admin-drawer"
              aria-label="Menu do ADM"
              aria-modal="true"
              role="dialog"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={handleDrawerKeyDown}
            >
              <div className="admin-drawer__top">
                <span>ADM NUMORA</span>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Fechar menu"
                >
                  ×
                </button>
              </div>
              {nav}
            </aside>
          </div>
        ) : null}

        <main id="admin-content" className="admin-content">{children}</main>
      </div>
    </div>
  );
}
