import { privacyConfig } from "@/config/privacy";
import { runtimeConfig } from "@/config/runtime";

export { withBasePath } from "@/config/runtime";

export const siteConfig = {
  name: "NUMORA",
  title: "NUMORA — Transformação Operacional Inteligente",
  description:
    "A NUMORA transforma processos empresariais por meio de estratégia, Inteligência Artificial, automação e integração, gerando operações mais eficientes e resultados mensuráveis.",
  ogTitle: "Operações melhores. Resultados mensuráveis.",
  ogDescription:
    "Transformação operacional por meio de estratégia, Inteligência Artificial, automação e integração.",
  locale: "pt_BR",
  language: "pt-BR",
  siteUrl: runtimeConfig.siteUrl,
  basePath: runtimeConfig.basePath,
  hasConfiguredSiteUrl: runtimeConfig.hasConfiguredSiteUrl,
  logo: `${runtimeConfig.basePath}/brand/logo-wordmark.png`,
  logoUrl: `${runtimeConfig.assetBaseUrl}/brand/logo-wordmark.png`,
  favicon: `${runtimeConfig.basePath}/brand/favicon.png`,
  favicon16: `${runtimeConfig.basePath}/brand/favicon-16.png`,
  favicon32: `${runtimeConfig.basePath}/brand/favicon-32.png`,
  appleTouchIcon: `${runtimeConfig.basePath}/brand/apple-touch-icon.png`,
  socialImage: `${runtimeConfig.basePath}/og.png`,
  socialImageUrl: `${runtimeConfig.assetBaseUrl}/og.png`,
  legalLinks: [
    { label: "Política de Privacidade", href: privacyConfig.internalUrl },
  ] as const,
} as const;

export const primaryNavigation = [
  { label: "Atuação", href: "#atuacao" },
  { label: "Como trabalhamos", href: "#como-trabalhamos" },
  { label: "Entregáveis", href: "#entregaveis" },
  { label: "Diferenciais", href: "#diferenciais" },
  { label: "Para quem", href: "#clientes" },
] as const;
