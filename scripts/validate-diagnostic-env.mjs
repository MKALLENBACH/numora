import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const configSource = readFileSync(resolve("src/config/diagnostic.ts"), "utf8");
const diagnosticEnabled = /enabled:\s*true\b/.test(configSource);

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
