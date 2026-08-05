const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");

export const siteConfig = {
  name: "NUMORA",
  title: "NUMORA — Transformação Operacional Inteligente",
  description:
    "A NUMORA transforma processos empresariais por meio de estratégia, Inteligência Artificial, automação e integração, gerando operações mais eficientes e resultados mensuráveis.",
  locale: "pt_BR",
  language: "pt-BR",
  siteUrl: configuredSiteUrl || "http://localhost:3000",
  hasConfiguredSiteUrl: Boolean(configuredSiteUrl),
  logo: "/brand/logo.jpeg",
  favicon: "/brand/favicon.jpeg",
  legalLinks: [] as ReadonlyArray<{ label: string; href: string }>,
} as const;

export const primaryNavigation = [
  { label: "Atuação", href: "#atuacao" },
  { label: "Como trabalhamos", href: "#como-trabalhamos" },
  { label: "Diferenciais", href: "#diferenciais" },
  { label: "Para quem", href: "#clientes" },
] as const;
