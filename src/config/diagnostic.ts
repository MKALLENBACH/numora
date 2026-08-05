import { siteConfig } from "@/config/site";

export const diagnosticConfig = {
  enabled: true,
  href: `${siteConfig.basePath}/diagnostico`,
  label: "Comece seu diagnóstico",
  microcopy: {
    enabled: "Diagnóstico inicial guiado · Aproximadamente 5 a 8 minutos",
    disabled: "Experiência de diagnóstico digital em preparação",
  },
  dialog: {
    title: "Diagnóstico digital em preparação",
    description:
      "Estamos preparando a experiência de diagnóstico da NUMORA. Em breve, você poderá descrever seu desafio e organizar uma conversa com nosso time por aqui.",
    closeLabel: "Entendi",
  },
} as const;
