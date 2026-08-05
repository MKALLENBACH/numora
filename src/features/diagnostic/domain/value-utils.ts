import type { PublicAnswerValue } from "../contracts";
import type { DiagnosticStructuredData } from "./types";

export function getValueAtPath(
  source: DiagnosticStructuredData | Record<string, unknown>,
  path: string,
): unknown {
  let current: unknown = source;

  for (const segment of path.split(".")) {
    if (
      typeof current !== "object" ||
      current === null ||
      !(segment in current)
    ) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

export function isPresent(value: unknown): boolean {
  if (value === undefined || value === null || value === "") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (
    typeof value === "object" &&
    "unknown" in value &&
    (value as { unknown?: unknown }).unknown === true
  ) {
    return false;
  }

  return true;
}

export function answerAsArray(value: PublicAnswerValue): readonly string[] {
  return Array.isArray(value) ? value : [];
}

export function answerAsText(value: PublicAnswerValue): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) return value.join(", ");
  if ("unknown" in value) return "Não informado";
  return `${value.value} ${value.unit}`;
}

export function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
