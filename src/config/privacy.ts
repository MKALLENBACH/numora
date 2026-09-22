import { withBasePath } from "@/config/site";

const defaultPolicyPath = "/politica-de-privacidade";
const configuredPolicyUrl = process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL?.trim();

function resolvePolicyUrl() {
  if (!configuredPolicyUrl) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "NEXT_PUBLIC_PRIVACY_POLICY_URL não foi configurada. Usando a rota interna segura /politica-de-privacidade.",
      );
    }

    return withBasePath(defaultPolicyPath);
  }

  if (/^https:\/\//i.test(configuredPolicyUrl)) {
    return configuredPolicyUrl;
  }

  if (!configuredPolicyUrl.startsWith("/")) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "NEXT_PUBLIC_PRIVACY_POLICY_URL é inválida. Usando a rota interna segura /politica-de-privacidade.",
      );
    }

    return withBasePath(defaultPolicyPath);
  }

  return withBasePath(configuredPolicyUrl);
}

export const privacyConfig = {
  policyPath: defaultPolicyPath,
  policyUrl: resolvePolicyUrl(),
  version: "1.0",
  lastUpdated: "22 de setembro de 2026",
  contactEmail: process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL?.trim() ?? "",
} as const;
