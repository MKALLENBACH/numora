import { z } from "zod";

const uuid = z.string().uuid();
const clientRequestId = uuid;
const diagnosticIdentity = {
  diagnosticId: uuid,
  sessionId: uuid,
};

export const StartSchema = z.object({
  clientRequestId,
  locale: z.string().min(2).max(20).default("pt-BR"),
  timezone: z.string().min(1).max(100).default("America/Sao_Paulo"),
}).strict();

export const ConsentSchema = z.object({
  ...diagnosticIdentity,
  type: z.enum(["PRIVACY", "COMMERCIAL"]),
  decision: z.enum(["ACCEPTED", "DECLINED"]),
  policyVersion: z.string().min(1).max(100),
  clientRequestId,
  rowVersion: z.number().int().positive().optional(),
}).strict();

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

export const IdentificationSchema = z.object({
  ...diagnosticIdentity,
  clientRequestId,
  rowVersion: z.number().int().positive().optional(),
  company: z.object({
    name: z.string().trim().min(2).max(200),
    website: optionalText(500),
    industry: z.string().trim().min(1).max(100),
    industryOther: optionalText(200),
    employeeRange: optionalText(50),
    size: optionalText(50),
    revenueRange: optionalText(50),
    countryCode: z.string().regex(/^[A-Za-z]{2}$/).default("BR"),
  }).strict().superRefine((value, context) => {
    if (!value.employeeRange && !value.size) {
      context.addIssue({ code: "custom", path: ["size"], message: "Porte obrigatório." });
    }
    if (value.industry === "OTHER" && !value.industryOther) {
      context.addIssue({ code: "custom", path: ["industryOther"], message: "Setor obrigatório." });
    }
  }),
  lead: z.object({
    name: z.string().trim().min(2).max(150),
    role: z.string().trim().min(2).max(150),
    roleCategory: optionalText(80),
    email: z.string().trim().email().max(320),
    phoneE164: z.string().regex(/^\+[1-9][0-9]{7,14}$/).optional().nullable(),
    phone: z.string().trim().max(30).refine((value) => {
      const length = value.replace(/\D/g, "").length;
      return length >= 10 && length <= 13;
    }).optional().nullable(),
  }).strict(),
  honeypot: z.string().max(0).optional(),
}).strict();

export const StateSchema = z.object({ diagnosticId: uuid.optional(), sessionId: uuid.optional() }).strict();

export const AnswerSchema = z.object({
  ...diagnosticIdentity,
  questionCode: z.string().regex(/^[A-Z][A-Z0-9_]{2,99}$/),
  questionVersion: z.string().min(1).max(30),
  responseType: z.enum([
    "SHORT_TEXT", "TEXT", "LONG_TEXT", "SINGLE_CHOICE", "MULTIPLE_CHOICE", "NUMBER",
    "NUMBER_WITH_UNIT", "CURRENCY_RANGE", "DATE", "YES_NO", "SCALE", "BOOLEAN",
    "CONFIRMATION", "SKIPPED",
  ]),
  value: z.unknown(),
  displayValue: z.string().max(10000).optional(),
  clientRequestId,
  rowVersion: z.number().int().positive(),
  startedAt: z.string().datetime({ offset: true }).optional(),
  elapsedMs: z.number().int().nonnegative().max(86_400_000).optional(),
  honeypot: z.string().max(0).optional(),
}).strict();

export const ActionSchema = z.object({ ...diagnosticIdentity }).strict();
export const GenerateReviewSchema = z.object({ ...diagnosticIdentity, clientRequestId }).strict();
export const UpdateReviewSchema = z.object({
  ...diagnosticIdentity,
  sectionKey: z.enum([
    "company", "affectedArea", "challenge", "currentProcess", "participants", "systems",
    "mainImpacts", "desiredOutcome", "priority", "deadline", "decisionContext", "additionalInformation",
  ]),
  value: z.union([z.string().max(2000), z.array(z.string().max(500)).max(20), z.null()]),
  reviewVersion: z.number().int().positive(),
  clientRequestId,
}).strict();
export const ConfirmReviewSchema = z.object({ ...diagnosticIdentity, reviewVersion: z.number().int().positive(), clientRequestId }).strict();
export const CompleteSchema = z.object({ ...diagnosticIdentity, clientRequestId }).strict();
export const AbandonSchema = z.object({ ...diagnosticIdentity, clientRequestId }).strict();

export type ParsedBody = Record<string, unknown>;
