import {
  PublicAnswerValueSchema,
  type PublicAnswerValue,
  type QuestionOption,
  type ResponseType,
} from "../contracts";
import type { QuestionValidation } from "./types";

export const ANSWER_VALIDATION_CODES = [
  "INVALID_ANSWER_SHAPE",
  "ANSWER_REQUIRED",
  "INVALID_RESPONSE_TYPE",
  "TEXT_TOO_SHORT",
  "TEXT_TOO_LONG",
  "VALUE_BELOW_MINIMUM",
  "VALUE_ABOVE_MAXIMUM",
  "INVALID_OPTION",
  "TOO_MANY_SELECTIONS",
  "DUPLICATE_SELECTION",
  "INVALID_UNIT",
  "UNKNOWN_NOT_ALLOWED",
  "INVALID_DATE",
] as const;

export type AnswerValidationCode = (typeof ANSWER_VALIDATION_CODES)[number];

export type AnswerValidationIssue = {
  readonly code: AnswerValidationCode;
  readonly message: string;
};

/**
 * The subset shared by the internal catalog question and its public projection.
 * Keeping validation against these catalog-owned fields prevents the browser from
 * deciding which values are accepted.
 */
export type AnswerValidatableQuestion = {
  readonly id: string;
  readonly responseType: ResponseType;
  readonly required: boolean;
  readonly options?: readonly QuestionOption[];
  readonly validation?: QuestionValidation;
};

export class DiagnosticAnswerValidationError extends Error {
  readonly issues: readonly AnswerValidationIssue[];

  constructor(questionId: string, issues: readonly AnswerValidationIssue[]) {
    super(`Invalid answer for question ${questionId}`);
    this.name = "DiagnosticAnswerValidationError";
    this.issues = issues;
  }
}

const issue = (
  code: AnswerValidationCode,
  message: string,
): AnswerValidationIssue => ({ code, message });

function isUnknownAnswer(
  value: PublicAnswerValue,
): value is { readonly unknown: true } {
  return !Array.isArray(value) &&
    typeof value === "object" &&
    value !== null &&
    "unknown" in value &&
    value.unknown === true;
}

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function validateText(
  value: string,
  question: AnswerValidatableQuestion,
): readonly AnswerValidationIssue[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return [issue("ANSWER_REQUIRED", "A resposta não pode estar vazia.")];
  }

  const issues: AnswerValidationIssue[] = [];
  const minimum = question.validation?.minLength;
  const maximum = question.validation?.maxLength;
  if (minimum !== undefined && trimmed.length < minimum) {
    issues.push(issue("TEXT_TOO_SHORT", `A resposta deve ter pelo menos ${minimum} caracteres.`));
  }
  if (maximum !== undefined && trimmed.length > maximum) {
    issues.push(issue("TEXT_TOO_LONG", `A resposta deve ter no máximo ${maximum} caracteres.`));
  }
  return issues;
}

function validateNumber(
  value: number,
  question: AnswerValidatableQuestion,
): readonly AnswerValidationIssue[] {
  const issues: AnswerValidationIssue[] = [];
  const minimum = question.validation?.min;
  const maximum = question.validation?.max;
  if (minimum !== undefined && value < minimum) {
    issues.push(issue("VALUE_BELOW_MINIMUM", `O valor mínimo é ${minimum}.`));
  }
  if (maximum !== undefined && value > maximum) {
    issues.push(issue("VALUE_ABOVE_MAXIMUM", `O valor máximo é ${maximum}.`));
  }
  if (question.responseType === "SCALE" && !Number.isInteger(value)) {
    issues.push(issue("INVALID_RESPONSE_TYPE", "A escala aceita somente valores inteiros."));
  }
  return issues;
}

function allowedOptionValues(
  question: AnswerValidatableQuestion,
): ReadonlySet<string> {
  return new Set(question.options?.map(({ value }) => value) ?? []);
}

/**
 * Parses the broad public union and then enforces the concrete response type,
 * options and validation rules owned by the server-side question catalog.
 * Returns the parsed value or throws a typed error with stable issue codes.
 */
export function validateAnswer(
  question: AnswerValidatableQuestion,
  value: unknown,
): PublicAnswerValue {
  const parsed = PublicAnswerValueSchema.safeParse(value);
  if (!parsed.success) {
    throw new DiagnosticAnswerValidationError(question.id, [
      issue("INVALID_ANSWER_SHAPE", "O formato da resposta é inválido."),
    ]);
  }

  const answer = parsed.data;
  if (isUnknownAnswer(answer)) {
    if (question.validation?.allowUnknown === true) return answer;
    throw new DiagnosticAnswerValidationError(question.id, [
      issue("UNKNOWN_NOT_ALLOWED", "Esta pergunta não aceita uma resposta desconhecida."),
    ]);
  }

  let issues: readonly AnswerValidationIssue[] = [];
  switch (question.responseType) {
    case "SHORT_TEXT":
    case "LONG_TEXT":
      issues = typeof answer === "string"
        ? validateText(answer, question)
        : [issue("INVALID_RESPONSE_TYPE", "Esta pergunta exige uma resposta em texto.")];
      break;
    case "DATE":
      issues = typeof answer !== "string"
        ? [issue("INVALID_RESPONSE_TYPE", "Esta pergunta exige uma data.")]
        : !isValidIsoDate(answer)
          ? [issue("INVALID_DATE", "A data deve existir e usar o formato AAAA-MM-DD.")]
          : [];
      break;
    case "SINGLE_CHOICE":
    case "CURRENCY_RANGE": {
      const allowed = allowedOptionValues(question);
      issues = typeof answer !== "string"
        ? [issue("INVALID_RESPONSE_TYPE", "Esta pergunta exige uma única opção.")]
        : !allowed.has(answer)
          ? [issue("INVALID_OPTION", "A opção informada não pertence a esta pergunta.")]
          : [];
      break;
    }
    case "MULTIPLE_CHOICE": {
      if (!Array.isArray(answer)) {
        issues = [issue("INVALID_RESPONSE_TYPE", "Esta pergunta exige uma lista de opções.")];
        break;
      }
      const selectionIssues: AnswerValidationIssue[] = [];
      if (answer.length === 0) {
        selectionIssues.push(issue("ANSWER_REQUIRED", "Selecione pelo menos uma opção."));
      }
      const maximum = question.validation?.maxSelections;
      if (maximum !== undefined && answer.length > maximum) {
        selectionIssues.push(issue("TOO_MANY_SELECTIONS", `Selecione no máximo ${maximum} opções.`));
      }
      if (new Set(answer).size !== answer.length) {
        selectionIssues.push(issue("DUPLICATE_SELECTION", "A mesma opção não pode ser repetida."));
      }
      const allowed = allowedOptionValues(question);
      if (answer.some((selected) => !allowed.has(selected))) {
        selectionIssues.push(issue("INVALID_OPTION", "Uma ou mais opções não pertencem a esta pergunta."));
      }
      issues = selectionIssues;
      break;
    }
    case "NUMBER":
    case "SCALE":
      issues = typeof answer === "number"
        ? validateNumber(answer, question)
        : [issue("INVALID_RESPONSE_TYPE", "Esta pergunta exige um valor numérico.")];
      break;
    case "NUMBER_WITH_UNIT": {
      if (Array.isArray(answer) || typeof answer !== "object" || answer === null || !("unit" in answer)) {
        issues = [issue("INVALID_RESPONSE_TYPE", "Esta pergunta exige um número e uma unidade.")];
        break;
      }
      const unitIssues = [...validateNumber(answer.value, question)];
      const units = question.validation?.units ?? [];
      if (!units.includes(answer.unit)) {
        unitIssues.push(issue("INVALID_UNIT", "A unidade informada não pertence a esta pergunta."));
      }
      issues = unitIssues;
      break;
    }
    case "YES_NO":
    case "CONFIRMATION":
      issues = typeof answer === "boolean"
        ? []
        : [issue("INVALID_RESPONSE_TYPE", "Esta pergunta exige uma resposta de sim ou não.")];
      break;
  }

  if (issues.length > 0) {
    throw new DiagnosticAnswerValidationError(question.id, issues);
  }
  return answer;
}
