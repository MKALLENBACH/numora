import type { DiagnosticFlagCode, DiagnosticSignal } from "./types";
import { normalizeText } from "./value-utils";

export const REDACTION_PLACEHOLDER = "[CONTEÚDO REMOVIDO POR SEGURANÇA]";
export const SENSITIVE_DATA_MESSAGE =
  "Para proteger você e sua empresa, não precisamos desse nível de detalhe. Podemos continuar usando uma descrição geral.";
export const INJECTION_REDIRECT_MESSAGE =
  "Posso ajudar a compreender o desafio operacional da sua empresa. Vamos continuar com a entrevista.";
export const ABUSE_REDIRECT_MESSAGE =
  "Vamos manter a conversa relacionada ao desafio operacional da empresa.";
export const SAFETY_BLOCK_MESSAGE =
  "Não foi possível continuar a entrevista dentro da finalidade proposta.";

export type SensitiveDataCategory =
  | "PASSWORD"
  | "TOKEN"
  | "API_KEY"
  | "PRIVATE_KEY"
  | "AUTHORIZATION_BEARER"
  | "CPF"
  | "PAYMENT_CARD"
  | "BANK_ACCOUNT"
  | "CREDENTIAL";

export type RedactionResult = {
  readonly redactedText: string;
  readonly categories: readonly SensitiveDataCategory[];
  readonly redactionCount: number;
  readonly severity: "NONE" | "SENSITIVE" | "SEVERE";
  readonly shouldBlock: boolean;
};

type Pattern = {
  readonly category: SensitiveDataCategory;
  readonly severe: boolean;
  readonly expression: RegExp;
};

const patterns: readonly Pattern[] = [
  {
    category: "PRIVATE_KEY",
    severe: true,
    expression: /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z]+)? PRIVATE KEY-----/gi,
  },
  {
    category: "AUTHORIZATION_BEARER",
    severe: true,
    expression: /\b(?:authorization\s*:\s*)?bearer\s+[a-z0-9._~+/=-]{16,}\b/gi,
  },
  {
    category: "API_KEY",
    severe: true,
    expression: /\b(?:sk-[a-z0-9_-]{16,}|AKIA[0-9A-Z]{16})\b/gi,
  },
  {
    category: "TOKEN",
    severe: true,
    expression: /\beyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\b/g,
  },
  {
    category: "PASSWORD",
    severe: true,
    expression: /\b(?:password|senha|passwd|pwd|secret|api[_ -]?key|access[_ -]?key)\s*[:=]\s*[^\s,;]{6,}/gi,
  },
  {
    category: "CPF",
    severe: false,
    expression: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
  },
  {
    category: "BANK_ACCOUNT",
    severe: false,
    expression: /\b(?:conta|account)\s*(?:corrente)?\s*[:#-]?\s*\d{4,12}(?:-\d{1,2})?\b/gi,
  },
  {
    category: "PAYMENT_CARD",
    severe: false,
    expression: /\b(?:\d[ -]*?){13,19}\b/g,
  },
];

function passesLuhn(candidate: string): boolean {
  const digits = candidate.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

export function redactSensitiveData(input: string): RedactionResult {
  let redactedText = input;
  let redactionCount = 0;
  let severe = false;
  const categories = new Set<SensitiveDataCategory>();

  for (const pattern of patterns) {
    redactedText = redactedText.replace(pattern.expression, (candidate) => {
      if (pattern.category === "PAYMENT_CARD" && !passesLuhn(candidate)) {
        return candidate;
      }
      redactionCount += 1;
      severe ||= pattern.severe;
      categories.add(pattern.category);
      return REDACTION_PLACEHOLDER;
    });
  }

  return {
    redactedText,
    categories: [...categories],
    redactionCount,
    severity: redactionCount === 0 ? "NONE" : severe ? "SEVERE" : "SENSITIVE",
    shouldBlock: severe,
  };
}

export type AbuseAssessment = {
  readonly kind: "NONE" | "PROMPT_INJECTION" | "ABUSE" | "ILLEGAL";
  readonly action: "CONTINUE" | "BLOCK";
  readonly message: string | null;
  readonly flags: readonly DiagnosticFlagCode[];
  readonly signals: readonly DiagnosticSignal[];
};

export function assessPromptInjectionAndAbuse(input: {
  readonly text: string;
  readonly priorInjectionAttempts?: number;
  readonly priorAbuseOccurrences?: number;
}): AbuseAssessment {
  const text = normalizeText(input.text);
  const illegal = /\b(roubar credenciais|fraudar|invadir sistema|ransomware|vender dados roubados)\b/.test(text);
  if (illegal) {
    return {
      kind: "ILLEGAL",
      action: "BLOCK",
      message: SAFETY_BLOCK_MESSAGE,
      flags: ["ILLEGAL_REQUEST"],
      signals: ["ILLEGAL_REQUEST"],
    };
  }

  const injection = [
    /ignore (?:todas |as )?(?:instrucoes|regras)/,
    /revele (?:o )?(?:prompt|system prompt|segredo)/,
    /mostre (?:suas |as )?(?:instrucoes|regras internas)/,
    /voce agora e/,
    /developer message|system message|jailbreak/,
  ].some((pattern) => pattern.test(text));
  if (injection) {
    const persistent = (input.priorInjectionAttempts ?? 0) >= 1;
    return {
      kind: "PROMPT_INJECTION",
      action: persistent ? "BLOCK" : "CONTINUE",
      message: persistent ? SAFETY_BLOCK_MESSAGE : INJECTION_REDIRECT_MESSAGE,
      flags: persistent
        ? ["PROMPT_INJECTION_ATTEMPT", "PERSISTENT_PROMPT_INJECTION"]
        : ["PROMPT_INJECTION_ATTEMPT"],
      signals: persistent
        ? ["PROMPT_INJECTION_ATTEMPT", "PERSISTENT_PROMPT_INJECTION"]
        : ["PROMPT_INJECTION_ATTEMPT"],
    };
  }

  const urlCount = input.text.match(/https?:\/\//gi)?.length ?? 0;
  const abuse = urlCount >= 5 || /(.)\1{15,}/.test(input.text);
  if (abuse) {
    const persistent = (input.priorAbuseOccurrences ?? 0) >= 1;
    return {
      kind: "ABUSE",
      action: persistent ? "BLOCK" : "CONTINUE",
      message: persistent ? SAFETY_BLOCK_MESSAGE : ABUSE_REDIRECT_MESSAGE,
      flags: persistent ? ["SPAM_OR_BOT", "PERSISTENT_ABUSE"] : ["SPAM_OR_BOT"],
      signals: persistent ? ["SPAM_OR_BOT", "PERSISTENT_ABUSE"] : ["SPAM_OR_BOT"],
    };
  }

  return { kind: "NONE", action: "CONTINUE", message: null, flags: [], signals: [] };
}
