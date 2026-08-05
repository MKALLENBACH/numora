const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim().replace(/\/$/, "") || "";
const resolvedSiteUrl = configuredSiteUrl || "http://localhost:3000";
const assetBaseUrl = `${new URL(resolvedSiteUrl).origin}${configuredBasePath}`;

export const siteConfig = {
  name: "NUMORA",
  title: "NUMORA — Transformação Operacional Inteligente",
  description:
    "A NUMORA transforma processos empresariais por meio de estratégia, Inteligência Artificial, automação e integração, gerando operações mais eficientes e resultados mensuráveis.",
  locale: "pt_BR",
  language: "pt-BR",
  siteUrl: resolvedSiteUrl,
  hasConfiguredSiteUrl: Boolean(configuredSiteUrl),
  logo: `${configuredBasePath}/brand/logo.jpeg`,
  logoUrl: `${assetBaseUrl}/brand/logo.jpeg`,
  favicon: `${configuredBasePath}/brand/favicon.jpeg`,
  socialImage: `${configuredBasePath}/og.png`,
  socialImageUrl: `${assetBaseUrl}/og.png`,
  legalLinks: [] as ReadonlyArray<{ label: string; href: string }>,
} as const;

export const primaryNavigation = [
  { label: "Atuação", href: "#atuacao" },
  { label: "Como trabalhamos", href: "#como-trabalhamos" },
  { label: "Diferenciais", href: "#diferenciais" },
  { label: "Para quem", href: "#clientes" },
] as const;
