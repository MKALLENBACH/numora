import type { Metadata } from "next";

import { DiagnosticPage } from "@/components/diagnostic/DiagnosticPage";
import { diagnosticConfig } from "@/config/diagnostic";
import { siteConfig } from "@/config/site";

const diagnosticCanonical = `${new URL(siteConfig.siteUrl).origin}${siteConfig.basePath}/diagnostico/`;

export const metadata: Metadata = {
  title: "Diagnóstico Inicial | NUMORA",
  description:
    "Organize o contexto do seu desafio operacional em uma entrevista inicial guiada pela NUMORA.",
  alternates: {
    canonical: diagnosticCanonical,
  },
  robots: diagnosticConfig.enabled ? { index: true, follow: true } : { index: false, follow: false },
};

export default function Page() {
  return <DiagnosticPage />;
}
