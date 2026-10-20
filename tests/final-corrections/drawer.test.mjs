import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { JSDOM } from "jsdom";

test("AdminShell removes its breakpoint listener and restores existing overflow on unmount", async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://localhost:3000/adm/" });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, React, IS_REACT_ACT_ENVIRONMENT: true });
  const listeners = new Set();
  const media = { matches: true, addEventListener: (_event, handler) => listeners.add(handler), removeEventListener: (_event, handler) => listeners.delete(handler) };
  window.matchMedia = () => media;
  // No configured client: the provider cannot make network requests in this unit fixture.
  process.env.NEXT_PUBLIC_SUPABASE_URL = "";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";
  const { createRoot } = await import("react-dom/client");
  const { PathnameContext } = await import("next/dist/shared/lib/hooks-client-context.shared-runtime.js");
  const { AdminAuthProvider } = await import("../../src/features/admin/AdminAuthProvider.tsx");
  const { AdminShell } = await import("../../src/features/admin/AdminShell.tsx");
  const root = createRoot(document.getElementById("root"));
  let mounted = true;
  try {
    await act(async () => root.render(React.createElement(PathnameContext.Provider, { value: "/adm/" }, React.createElement(AdminAuthProvider, null, React.createElement(AdminShell, null, "Fixture")))));
    assert.equal(listeners.size, 1);
    document.body.style.overflow = "scroll";
    await act(async () => document.querySelector(".admin-menu-button").click());
    assert.equal(document.body.style.overflow, "hidden");
    await act(async () => root.unmount()); mounted = false;
    assert.equal(document.body.style.overflow, "scroll");
    assert.equal(listeners.size, 0);
  } finally {
    if (mounted) await act(async () => root.unmount());
    dom.window.close();
  }
});
