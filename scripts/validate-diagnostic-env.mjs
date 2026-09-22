import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const configSource = readFileSync(resolve("src/config/diagnostic.ts"), "utf8");
const diagnosticEnabled = /enabled:\s*true\b/.test(configSource);
const privacyConfigSource = readFileSync(resolve("src/config/privacy.ts"), "utf8");
const privacyStatus = privacyConfigSource.match(
  /privacyPolicyStatus:\s*PrivacyPolicyStatus\s*=\s*"([A-Z]+)"/,
)?.[1];
const privacyVersion = privacyConfigSource.match(/version:\s*"([^"]+)"/)?.[1]?.trim();
const privacyLastUpdated = privacyConfigSource.match(/lastUpdated:\s*"([^"]+)"/)?.[1]?.trim();
const appEnvironment = process.env.APP_ENV?.trim().toLowerCase() || "development";
const privacyEmail = process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL?.trim();
const validEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!privacyStatus || !["DRAFT", "APPROVED"].includes(privacyStatus)) {
  console.error("O status editorial da Política de Privacidade precisa ser DRAFT ou APPROVED.");
  process.exitCode = 1;
}

if (privacyEmail && !validEmailPattern.test(privacyEmail)) {
  console.error("NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL precisa conter um e-mail válido.");
  process.exitCode = 1;
}

if (appEnvironment === "production") {
  if (privacyStatus === "DRAFT") {
    console.warn(
      "A Política de Privacidade está em DRAFT. Ela permanecerá com noindex e fora do sitemap.",
    );
  }

  if (privacyStatus === "APPROVED") {
    const missingPolicyConfiguration = [
      !privacyVersion ? "versão" : null,
      !privacyLastUpdated ? "data de atualização" : null,
      !privacyEmail ? "canal de privacidade" : null,
    ].filter(Boolean);

    if (missingPolicyConfiguration.length > 0) {
      console.error(
        `Política APPROVED sem configuração obrigatória: ${missingPolicyConfiguration.join(", ")}.`,
      );
      process.exitCode = 1;
    }
  }
}

const requiredPublicVariables = [
  "NEXT_PUBLIC_PRIVACY_POLICY_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

const missing = requiredPublicVariables.filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
  const message = [
    "Configuração do diagnóstico incompleta.",
    `Variáveis ausentes: ${missing.join(", ")}.`,
    "O CTA deve permanecer desativado até a política e o backend serem validados.",
  ].join(" ");

  if (diagnosticEnabled) {
    console.error(message);
    process.exitCode = 1;
  } else {
    console.warn(message);
  }
}

for (const variable of ["NEXT_PUBLIC_PRIVACY_POLICY_URL", "NEXT_PUBLIC_SUPABASE_URL"]) {
  const value = process.env[variable]?.trim();
  if (!value) continue;

  if (variable === "NEXT_PUBLIC_PRIVACY_POLICY_URL" && value.startsWith("/")) {
    if (value !== "/politica-de-privacidade") {
      console.error(
        "NEXT_PUBLIC_PRIVACY_POLICY_URL deve apontar para /politica-de-privacidade; o base path é aplicado automaticamente.",
      );
      process.exitCode = 1;
    }
    continue;
  }

  try {
    const url = new URL(value);
    const local = new Set(["localhost", "127.0.0.1", "::1"]).has(url.hostname);
    if (url.protocol !== "https:" && !(local && variable === "NEXT_PUBLIC_SUPABASE_URL")) {
      throw new Error("HTTPS obrigatório");
    }
    if (variable === "NEXT_PUBLIC_PRIVACY_POLICY_URL" && local) {
      throw new Error("localhost não é permitido");
    }
  } catch {
    console.error(`${variable} precisa conter uma URL HTTPS válida.`);
    process.exitCode = 1;
  }
}
