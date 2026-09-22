import { withBasePath } from "@/config/runtime";

export type PrivacyPolicyStatus = "DRAFT" | "APPROVED";

const defaultPolicyPath = "/politica-de-privacidade";
const configuredPolicyUrl = process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL?.trim();
const configuredPrivacyEmail = process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL?.trim();
const privacyPolicyStatus: PrivacyPolicyStatus = "DRAFT";
const isProductionEnvironment = process.env.APP_ENV?.trim().toLowerCase() === "production";
const validEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function resolvePrivacyEmail() {
  if (!configuredPrivacyEmail) return null;
  if (validEmailPattern.test(configuredPrivacyEmail)) return configuredPrivacyEmail;

  if (process.env.NODE_ENV === "development") {
    console.warn("Privacy email is not configured with a valid address.");
  }
  return null;
}

function isApproved(status: PrivacyPolicyStatus) {
  return status === "APPROVED";
}

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
  internalUrl: withBasePath(defaultPolicyPath),
  policyUrl: resolvePolicyUrl(),
  version: "1.0",
  status: privacyPolicyStatus,
  lastUpdated: "22 de setembro de 2026",
  privacyEmail: resolvePrivacyEmail(),
  isProductionEnvironment,
  isIndexable: isProductionEnvironment && isApproved(privacyPolicyStatus),
} as const;
