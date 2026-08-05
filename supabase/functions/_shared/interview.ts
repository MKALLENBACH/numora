import { AppError } from "./errors.ts";
import {
  DEFAULT_INTERVIEW_RULES,
  getNextInterviewAction,
} from "./generated/domain-runtime.js";
import { GENERATED_INTERVIEW_CATALOG } from "./generated/question-catalog.ts";
import type { Json, PublicQuestion } from "./types.ts";

export const CATALOG_VERSION = GENERATED_INTERVIEW_CATALOG.version;

type ClarificationType =
  | "VAGUE_PROBLEM" | "AREA_WITHOUT_PROCESS" | "GENERIC_AI_REQUEST"
  | "GENERIC_AUTOMATION_REQUEST" | "INCOMPLETE_PROCESS" | "IMPACT_MISSING"
  | "CONTRADICTION";

type QuestionCondition =
  | { type: "ALL" | "ANY"; conditions: readonly QuestionCondition[] }
  | { type: "NOT"; condition: QuestionCondition }
  | { type: "ANSWER_EQUALS"; questionId: string; value: string | number | boolean }
  | { type: "ANSWER_INCLUDES"; questionId: string; value: string }
  | { type: "ANSWER_ARRAY_MIN_LENGTH"; questionId: string; minimum: number }
  | { type: "FIELD_PRESENT" | "FIELD_MISSING"; path: string }
  | { type: "FIELD_IN"; path: string; values: readonly (string | number | boolean)[] }
  | { type: "SIGNAL_PRESENT"; signal: string }
  | { type: "QUESTION_COUNT_BELOW"; limit: number }
  | { type: "AREA_EQUALS"; area: string };

export type CatalogQuestion = {
  id: string;
  version: string;
  stage: "CHALLENGE" | "CURRENT_PROCESS" | "IMPACT" | "BUYING_CONTEXT";
  text: string;
  purpose: string;
  responseType: PublicQuestion["responseType"];
  required: boolean;
  critical: boolean;
  options?: ReadonlyArray<{ value: string; label: string }>;
  validation?: {
    minLength?: number; maxLength?: number; min?: number; max?: number;
    maxSelections?: number; units?: readonly string[]; allowUnknown?: boolean;
  };
  displayCondition?: QuestionCondition;
  maxClarifications: number;
  targetPaths: readonly string[];
  scoringDimensions: readonly string[];
  priority: number;
  kind: "CORE" | "AREA_SPECIFIC";
  defaultClarificationType?: ClarificationType;
};

export type StoredAnswer = {
  id: string;
  question_code: string;
  question_version: string;
  response_type: string;
  raw_value: Json;
  normalized_value: Json | null;
  display_value: string | null;
  validation_status: string;
  revision: number;
  created_at: string;
};

export type StoredEvidence = {
  answer_id: string | null;
  target_path: string;
  source_type: "REPORTED_FACT" | "CLIENT_ESTIMATE" | "AI_INFERENCE" | "SYSTEM_DERIVED" | "NOT_CONFIRMED";
  text: string;
  confidence: number;
};

type StructuredSection = Record<string, Json | undefined>;
export type StructuredData = {
  lead: StructuredSection;
  challenge: StructuredSection;
  currentProcess: StructuredSection;
  impact: StructuredSection;
  buyingContext: StructuredSection;
  technicalContext: StructuredSection;
};

export type InterviewContext = {
  status: string;
  privacyConsent: boolean | null;
  commercialConsent: boolean | null;
  privacyConsentVersion?: string;
  commercialConsentVersion?: string;
  identificationComplete: boolean;
  structuredData: StructuredData;
  answers: Array<{
    id: string; questionId: string; questionVersion: string; value: Json;
    clarity: "CLEAR" | "PARTIAL" | "VAGUE"; revision: number;
    answeredAtEpochMs: number; needsClarification: boolean;
    clarificationType?: ClarificationType;
  }>;
  askedQuestionIds: string[];
  clarifications: Array<{
    id: string; type: ClarificationType; relatedQuestionId: string;
    text: string; sequence: number; answered: boolean;
  }>;
  evidence: Array<{
    path: string;
    sourceType: StoredEvidence["source_type"];
    confidence: number;
    answerId: string;
    questionId: string;
    evidenceText: string;
  }>;
  signals: string[];
  review: null;
  reviewConfirmed: boolean;
  reviewCycles: number;
  startedAtEpochMs: number;
  expiresAtEpochMs: number;
  currentTimeEpochMs: number;
};

export type NextAction =
  | { type: "ASK_QUESTION"; question: CatalogQuestion }
  | { type: "ASK_CLARIFICATION"; question: PublicQuestion; relatedQuestionId: string; clarificationType: ClarificationType }
  | { type: "GENERATE_REVIEW" }
  | { type: "SHOW_REVIEW" }
  | { type: "COMPLETE" }
  | { type: "BLOCK"; reason: string };

const CATALOG = GENERATED_INTERVIEW_CATALOG.questions as unknown as readonly CatalogQuestion[];

export function getCatalogQuestion(id: string): CatalogQuestion | undefined {
  return CATALOG.find((question) => question.id === id);
}

export function toPublicQuestion(question: CatalogQuestion): PublicQuestion {
  const validation: PublicQuestion["validation"] | undefined = question.validation
    ? {
      minLength: question.validation.minLength,
      maxLength: question.validation.maxLength,
      min: question.validation.min,
      max: question.validation.max,
      maxSelections: question.validation.maxSelections,
      allowUnknown: question.validation.allowUnknown,
      ...(question.validation.units ? { units: [...question.validation.units] } : {}),
    }
    : undefined;
  return {
    id: question.id,
    version: question.version,
    stage: question.stage,
    text: question.text,
    responseType: question.responseType,
    required: question.required,
    ...(question.options ? { options: question.options.map((option) => ({ ...option })) } : {}),
    ...(validation ? { validation } : {}),
  };
}

const CLARIFICATION_TEMPLATES: Record<ClarificationType, (area?: string) => string> = {
  VAGUE_PROBLEM: () => "Para compreendermos melhor, poderia dar um exemplo concreto de quando esse problema acontece?",
  AREA_WITHOUT_PROCESS: (area) => `Dentro de ${area ?? "essa área"}, qual atividade mais consome tempo, gera erros ou dificulta o crescimento?`,
  GENERIC_AI_REQUEST: () => "Antes de pensar em tecnologia, qual problema operacional essa iniciativa deveria resolver?",
  GENERIC_AUTOMATION_REQUEST: () => "Qual processo você gostaria de automatizar e o que atualmente torna esse processo ineficiente?",
  INCOMPLETE_PROCESS: () => "O que acontece primeiro, quem recebe a demanda e como o processo é finalizado?",
  IMPACT_MISSING: () => "Por que essa iniciativa é importante para a empresa neste momento?",
  CONTRADICTION: () => "Identifiquei informações que parecem diferentes entre si. Qual delas representa melhor a situação atual?",
};

function clarificationCode(questionId: string, type: ClarificationType, sequence: number): string {
  return `CLARIFY__${questionId}__${type}__${sequence}`;
}

export function parseClarificationCode(code: string): { relatedQuestionId: string; type: ClarificationType; sequence: number } | null {
  const match = code.match(/^CLARIFY__([A-Z0-9_]+)__([A-Z_]+)__([1-3])$/);
  if (!match) return null;
  return { relatedQuestionId: match[1], type: match[2] as ClarificationType, sequence: Number(match[3]) };
}

export function clarificationPublicQuestion(code: string, area?: string, canonicalText?: string): PublicQuestion | null {
  const parsed = parseClarificationCode(code);
  if (!parsed || !CLARIFICATION_TEMPLATES[parsed.type]) return null;
  const related = getCatalogQuestion(parsed.relatedQuestionId);
  return {
    id: code,
    version: CATALOG_VERSION,
    stage: related?.stage ?? "CHALLENGE",
    text: canonicalText ?? CLARIFICATION_TEMPLATES[parsed.type](area),
    responseType: "LONG_TEXT",
    required: true,
    validation: { minLength: 3, maxLength: 2000 },
  };
}

function isUnknown(value: Json): boolean {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, Json>).unknown === true);
}

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
}

export function validateCatalogAnswer(input: {
  currentQuestionCode: string;
  questionVersion: string;
  responseType: string;
  value: Json;
}): { question: CatalogQuestion | null; value: Json; isClarification: boolean } {
  const clarification = clarificationPublicQuestion(input.currentQuestionCode);
  const question = getCatalogQuestion(input.currentQuestionCode);
  const expected = question ? toPublicQuestion(question) : clarification;
  if (!expected || expected.version !== input.questionVersion) throw new AppError("STATE_CONFLICT", 409);
  if (input.responseType === "SKIPPED") {
    if (!question || question.required || input.value !== "") throw new AppError("VALIDATION_ERROR", 422);
    return { question, value: input.value, isClarification: false };
  }
  if (expected.responseType !== input.responseType) throw new AppError("STATE_CONFLICT", 409);
  const validation = expected.validation ?? {};
  const value = input.value;
  if (isUnknown(value)) {
    if (!validation.allowUnknown) throw new AppError("VALIDATION_ERROR", 422);
    return { question: question ?? null, value, isClarification: Boolean(clarification) };
  }
  const optionValues = new Set(expected.options?.map((option) => option.value) ?? []);
  const invalid = (): never => { throw new AppError("VALIDATION_ERROR", 422); };
  switch (expected.responseType) {
    case "SHORT_TEXT":
    case "LONG_TEXT": {
      if (typeof value !== "string" || value.trim().length === 0) invalid();
      const length = (value as string).trim().length;
      if (validation.minLength !== undefined && length < validation.minLength) invalid();
      if (validation.maxLength !== undefined && length > validation.maxLength) invalid();
      break;
    }
    case "DATE":
      if (typeof value !== "string" || !isValidIsoDate(value)) invalid();
      break;
    case "SINGLE_CHOICE":
    case "CURRENCY_RANGE":
      if (typeof value !== "string" || !optionValues.has(value)) invalid();
      break;
    case "MULTIPLE_CHOICE": {
      if (!Array.isArray(value)) invalid();
      const selections = value as Json[];
      if (selections.length === 0 || selections.some((item) => typeof item !== "string" || !optionValues.has(item))) invalid();
      if (new Set(selections).size !== selections.length || (validation.maxSelections !== undefined && selections.length > validation.maxSelections)) invalid();
      break;
    }
    case "NUMBER":
    case "SCALE":
      if (typeof value !== "number" || !Number.isFinite(value)) invalid();
      if (expected.responseType === "SCALE" && !Number.isInteger(value as number)) invalid();
      if (validation.min !== undefined && (value as number) < validation.min) invalid();
      if (validation.max !== undefined && (value as number) > validation.max) invalid();
      break;
    case "NUMBER_WITH_UNIT": {
      if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
      const object = value as Record<string, Json>;
      const unit = object.unit;
      const number = object.value;
      if (typeof number !== "number" || !Number.isFinite(number) || typeof unit !== "string") invalid();
      if (validation.min !== undefined && (number as number) < validation.min) invalid();
      if (validation.max !== undefined && (number as number) > validation.max) invalid();
      if (validation.units && !validation.units.includes(unit as string)) invalid();
      break;
    }
    case "YES_NO":
    case "CONFIRMATION":
      if (typeof value !== "boolean") invalid();
      break;
  }
  return { question: question ?? null, value, isClarification: Boolean(clarification) };
}

export function selectNextAction(context: InterviewContext): NextAction {
  const action = getNextInterviewAction(
    context,
    GENERATED_INTERVIEW_CATALOG,
    DEFAULT_INTERVIEW_RULES,
  );
  if (action.type === "ASK_QUESTION") {
    const question = getCatalogQuestion(action.questionId);
    if (!question) throw new AppError("PERSISTENCE_UNAVAILABLE", 503);
    return { type: "ASK_QUESTION", question };
  }
  if (action.type === "ASK_CLARIFICATION") {
    const clarification = action.clarification;
    const code = clarificationCode(
      clarification.relatedQuestionId,
      clarification.type as ClarificationType,
      clarification.sequence,
    );
    const question = clarificationPublicQuestion(code, undefined, clarification.text);
    if (!question) throw new AppError("PERSISTENCE_UNAVAILABLE", 503);
    return {
      type: "ASK_CLARIFICATION",
      question,
      relatedQuestionId: clarification.relatedQuestionId,
      clarificationType: clarification.type as ClarificationType,
    };
  }
  return action;
}

function setValueAtPath(data: StructuredData, path: string, value: Json): void {
  const [section, field] = path.split(".");
  if (!section || !field || !(section in data)) return;
  data[section as keyof StructuredData][field] = value;
}

export function createInterviewContext(input: {
  diagnostic: { status: string; created_at: string };
  session: { expires_at: string };
  answers: StoredAnswer[];
  evidence: StoredEvidence[];
  consents: Array<{ consent_type: string; decision: string; policy_version: string }>;
  lead: Record<string, unknown> | null;
  company: Record<string, unknown> | null;
  signals: string[];
}): InterviewContext {
  const data: StructuredData = {
    lead: input.lead ? {
      name: input.lead.name as Json, role: input.lead.role as Json,
      company: input.company?.name as Json, email: input.lead.email as Json,
      industry: input.company?.industry as Json, industryOther: input.company?.industry_other as Json,
      employeeRange: input.company?.employee_range as Json, phone: input.lead.phone_e164 as Json,
      revenueRange: input.company?.revenue_range as Json,
    } : {},
    challenge: {}, currentProcess: {}, impact: {}, buyingContext: {}, technicalContext: {},
  };
  const answers: InterviewContext["answers"] = [];
  const clarifications: InterviewContext["clarifications"] = [];
  for (const answer of input.answers) {
    const parsed = parseClarificationCode(answer.question_code);
    if (parsed) {
      clarifications.push({
        id: answer.question_code, type: parsed.type, relatedQuestionId: parsed.relatedQuestionId,
        text: clarificationPublicQuestion(answer.question_code)?.text ?? "Esclarecimento",
        sequence: parsed.sequence, answered: true,
      });
      continue;
    }
    const question = getCatalogQuestion(answer.question_code);
    if (!question) continue;
    const skipped = answer.response_type === "SKIPPED";
    const primaryPath = question.targetPaths[0];
    const hasNormalizedProjection = answer.normalized_value !== null &&
      typeof answer.normalized_value === "object" &&
      !Array.isArray(answer.normalized_value);
    const normalizedProjection = hasNormalizedProjection
      ? answer.normalized_value as Record<string, Json>
      : null;
    if (!skipped && hasNormalizedProjection) {
      for (const [path, value] of Object.entries(normalizedProjection ?? {})) {
        if (!path.includes(".")) continue;
        setValueAtPath(data, path, value);
      }
    }
    if (!skipped && !hasNormalizedProjection && primaryPath) setValueAtPath(data, primaryPath, answer.raw_value);
    const clarity = answer.validation_status === "VALID"
      ? "CLEAR" : answer.validation_status === "NOT_CONFIRMED" ? "PARTIAL" : "VAGUE";
    answers.push({
      id: answer.id, questionId: answer.question_code, questionVersion: answer.question_version,
      value: answer.raw_value, clarity, revision: answer.revision,
      answeredAtEpochMs: new Date(answer.created_at).getTime(),
      needsClarification: !skipped && clarity !== "CLEAR",
    });
  }
  const currentAnswers = new Map(answers.map((answer) => [answer.id, answer]));
  const evidence: InterviewContext["evidence"] = input.evidence.flatMap((item) => {
    if (!item.answer_id) return [];
    const answer = currentAnswers.get(item.answer_id);
    if (!answer) return [];
    return [{
      path: item.target_path, sourceType: item.source_type, confidence: item.confidence,
      answerId: item.answer_id, questionId: answer.questionId, evidenceText: item.text,
    }];
  });
  const signals = [...input.signals];
  if ((data.currentProcess.systems as Json[] | undefined)?.length && (data.currentProcess.systems as Json[]).length >= 2) signals.push("MULTIPLE_SYSTEMS");
  if (data.currentProcess.duplicateDataEntry === true) signals.push("DUPLICATE_DATA_ENTRY");
  if (typeof data.currentProcess.manualDependency === "string" && data.currentProcess.manualDependency.trim()) signals.push("MANUAL_PROCESS");
  const privacy = input.consents.find((item) => item.consent_type === "PRIVACY");
  const commercial = input.consents.find((item) => item.consent_type === "COMMERCIAL");
  return {
    status: input.diagnostic.status,
    privacyConsent: privacy ? privacy.decision === "ACCEPTED" : null,
    commercialConsent: commercial ? commercial.decision === "ACCEPTED" : null,
    ...(privacy ? { privacyConsentVersion: privacy.policy_version } : {}),
    ...(commercial ? { commercialConsentVersion: commercial.policy_version } : {}),
    identificationComplete: Boolean(input.lead), structuredData: data, answers,
    askedQuestionIds: answers.map((answer) => answer.questionId), clarifications, evidence,
    signals: [...new Set(signals)], review: null, reviewConfirmed: false, reviewCycles: 0,
    startedAtEpochMs: new Date(input.diagnostic.created_at).getTime(),
    expiresAtEpochMs: new Date(input.session.expires_at).getTime(), currentTimeEpochMs: Date.now(),
  };
}

export function appendProposedAnswer(context: InterviewContext, input: {
  code: string;
  value: Json;
  clarity: "CLEAR" | "PARTIAL" | "VAGUE";
  skipped: boolean;
  normalizedFields?: Record<string, Json>;
}): InterviewContext {
  const parsed = parseClarificationCode(input.code);
  if (parsed) {
    return { ...context, clarifications: [...context.clarifications, {
      id: input.code, type: parsed.type, relatedQuestionId: parsed.relatedQuestionId,
      text: clarificationPublicQuestion(input.code)?.text ?? "Esclarecimento",
      sequence: parsed.sequence, answered: true,
    }] };
  }
  const question = getCatalogQuestion(input.code);
  if (!question) throw new AppError("STATE_CONFLICT", 409);
  const data = structuredClone(context.structuredData);
  const primaryPath = question.targetPaths[0];
  if (!input.skipped && input.normalizedFields !== undefined) {
    for (const [path, value] of Object.entries(input.normalizedFields)) {
      setValueAtPath(data, path, value);
    }
  } else if (!input.skipped && primaryPath) {
    setValueAtPath(data, primaryPath, input.value);
  }
  const answer: InterviewContext["answers"][number] = {
    id: crypto.randomUUID(), questionId: question.id, questionVersion: question.version,
    value: input.value, clarity: input.clarity, revision: 1,
    answeredAtEpochMs: Date.now(), needsClarification: !input.skipped && input.clarity !== "CLEAR",
  };
  return {
    ...context, structuredData: data,
    answers: [...context.answers.filter((item) => item.questionId !== question.id), answer],
    askedQuestionIds: [...new Set([...context.askedQuestionIds, question.id])],
  };
}

export function flattenStructuredData(data: StructuredData): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const visit = (value: unknown, prefix: string) => {
    if (value && typeof value === "object" && !Array.isArray(value) && !("value" in value)) {
      for (const [key, child] of Object.entries(value)) visit(child, prefix ? `${prefix}.${key}` : key);
    } else if (prefix && value !== undefined) result[prefix] = value;
  };
  visit(data, "");
  return result;
}

function valueAtPath(data: StructuredData, path: string): unknown {
  const [section, field] = path.split(".");
  if (!section || !field || !(section in data)) return undefined;
  return data[section as keyof StructuredData][field];
}

function present(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object" && "unknown" in value && value.unknown === true) return false;
  if (typeof value === "string" && [
    "UNKNOWN", "NOT_INFORMED", "PREFER_NOT_TO_SAY", "NOT_ESTIMATED",
    "UNDEFINED", "NOT_MEASURED",
  ].includes(value)) return false;
  return true;
}

export function missingCriticalPaths(context: InterviewContext): string[] {
  return GENERATED_INTERVIEW_CATALOG.criticalPaths.filter((path) => !present(valueAtPath(context.structuredData, path)));
}
