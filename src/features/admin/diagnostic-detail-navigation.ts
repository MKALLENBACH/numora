import { withBasePath } from "@/config/runtime";

import {
  ADMIN_DIAGNOSTIC_TABS,
  type AdminDiagnosticTab,
} from "./diagnostic-detail-contract";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tabSet = new Set<string>(ADMIN_DIAGNOSTIC_TABS);

export function isDiagnosticId(value: string | null): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isDiagnosticTab(value: string): value is AdminDiagnosticTab {
  return tabSet.has(value);
}

export function diagnosticDetailHref(
  diagnosticId: string,
  tab: AdminDiagnosticTab = "visao-geral",
) {
  return `${withBasePath("/adm/diagnostico/")}?id=${encodeURIComponent(diagnosticId)}#${tab}`;
}

export function currentProtectedAdminReturnTo() {
  const fallback = window.location.pathname;
  const detailPath = withBasePath("/adm/diagnostico/");
  const normalizedPath = window.location.pathname.endsWith("/")
    ? window.location.pathname
    : `${window.location.pathname}/`;
  if (normalizedPath !== detailPath) return fallback;

  const params = new URLSearchParams(window.location.search);
  const ids = params.getAll("id");
  if (ids.length !== 1 || !isDiagnosticId(ids[0])) return detailPath;
  const hash = window.location.hash.slice(1);
  const tab = isDiagnosticTab(hash) ? hash : "visao-geral";
  return `${detailPath}?id=${encodeURIComponent(ids[0])}#${tab}`;
}
