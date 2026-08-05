import type { Json, Redaction } from "./types.ts";

const REPLACEMENT = "[CONTEÚDO REMOVIDO POR SEGURANÇA]";

const RULES: Array<{
  category: Redaction["category"];
  severe: boolean;
  pattern: RegExp;
}> = [
  { category: "PRIVATE_KEY", severe: true, pattern: /-----BEGIN[\s\S]{0,80}?PRIVATE KEY-----[\s\S]*?-----END[\s\S]{0,80}?PRIVATE KEY-----/gi },
  { category: "TOKEN", severe: true, pattern: /\beyJ[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\b/gi },
  { category: "API_KEY", severe: true, pattern: /\bsk-(?:proj-|svcacct-)?[a-z0-9_-]{16,}\b/gi },
  { category: "API_KEY", severe: true, pattern: /\bAKIA[A-Z0-9]{16}\b/g },
  { category: "TOKEN", severe: true, pattern: /authorization\s*:\s*bearer\s+[a-z0-9._~+\/-]{12,}/gi },
  { category: "API_KEY", severe: true, pattern: /\b(?:sk|pk)_(?:live|test)_[a-z0-9]{12,}\b/gi },
  { category: "TOKEN", severe: true, pattern: /\b(?:gh[pousr]_[a-z0-9]{20,}|xox[baprs]-[a-z0-9-]{12,})\b/gi },
  { category: "CREDENTIAL", severe: true, pattern: /\b(?:client[_ -]?secret|aws[_ -]?secret[_ -]?access[_ -]?key|access[_ -]?secret)\s*[:=]\s*[^\s,;]{8,}/gi },
  { category: "OTHER_SECRET", severe: true, pattern: /\b(?:webhook|signing|encryption)[_ -]?secret\s*[:=]\s*[^\s,;]{8,}/gi },
  { category: "PASSWORD", severe: false, pattern: /\b(?:senha|password|passwd)\s*[:=]\s*[^\s,;]{4,}/gi },
  { category: "API_KEY", severe: false, pattern: /\b(?:api[_ -]?key|secret|token)\s*[:=]\s*[^\s,;]{8,}/gi },
  { category: "CPF", severe: false, pattern: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g },
  { category: "CARD", severe: false, pattern: /\b(?:\d[ -]*?){13,19}\b/g },
  { category: "BANK_ACCOUNT", severe: false, pattern: /\b(?:ag[eê]ncia|conta)\s*[:=]?\s*\d[\d.-]{3,}\b/gi },
];

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function redactString(value: string, path: string): Promise<{ value: string; redactions: Redaction[] }> {
  let safeValue = value;
  const redactions: Redaction[] = [];
  for (const rule of RULES) {
    const matches = [...safeValue.matchAll(rule.pattern)];
    for (const match of matches) {
      if (!match[0]) continue;
      redactions.push({
        category: rule.category,
        fieldPath: path,
        fingerprint: await sha256(match[0]),
        severe: rule.severe,
      });
    }
    safeValue = safeValue.replace(rule.pattern, REPLACEMENT);
  }
  return { value: safeValue, redactions };
}

export async function redactValue(value: unknown, path = "answer"): Promise<{ value: Json; redactions: Redaction[] }> {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return { value: value as Json, redactions: [] };
  }
  if (typeof value === "string") return redactString(value, path);
  if (Array.isArray(value)) {
    const values: Json[] = [];
    const redactions: Redaction[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const result = await redactValue(value[index], `${path}[${index}]`);
      values.push(result.value);
      redactions.push(...result.redactions);
    }
    return { value: values, redactions };
  }
  if (typeof value === "object") {
    const output: Record<string, Json> = {};
    const redactions: Redaction[] = [];
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const result = await redactValue(item, `${path}.${key}`);
      output[key] = result.value;
      redactions.push(...result.redactions);
    }
    return { value: output, redactions };
  }
  return { value: String(value), redactions: [] };
}

export function stringifyDisplayValue(value: Json): string {
  if (typeof value === "string") return value;
  if (value === null) return "";
  if (Array.isArray(value)) return value.map((item) => typeof item === "string" ? item : JSON.stringify(item)).join(", ");
  return JSON.stringify(value);
}

export function detectsPromptInjection(value: string): boolean {
  return /(?:ignore|ignorar|desconsidere).{0,40}(?:instruções|instructions|prompt)|(?:revele|show|exponha).{0,40}(?:prompt|segredo|system)|\bdeveloper message\b|\bsystem prompt\b/i.test(value);
}

export function detectsAbuse(value: string): boolean {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(?:quero|vamos|preciso|pretendo|ensine|como)\b.{0,60}\b(?:atacar|hackear|fraudar|cometer fraude|enviar spam)\b/i.test(normalized) &&
    !/\b(?:evitar|reduzir|detectar|prevenir|combater|proteger|risco|relato|sofrendo)\b/i.test(normalized);
}
