import { z } from "zod";

export const RESPONSE_TYPES = [
  "SHORT_TEXT",
  "LONG_TEXT",
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "NUMBER",
  "NUMBER_WITH_UNIT",
  "CURRENCY_RANGE",
  "DATE",
  "YES_NO",
  "SCALE",
  "CONFIRMATION",
] as const;

export const ResponseTypeSchema = z.enum(RESPONSE_TYPES);
export type ResponseType = z.infer<typeof ResponseTypeSchema>;

export const QUESTION_STAGES = [
  "CHALLENGE",
  "CURRENT_PROCESS",
  "IMPACT",
  "BUYING_CONTEXT",
] as const;

export const QuestionStageSchema = z.enum(QUESTION_STAGES);
export type QuestionStage = z.infer<typeof QuestionStageSchema>;

export const PUBLIC_INTERVIEW_STAGES = [
  "INTRODUCTION",
  "PRIVACY_CONSENT",
  "COMMERCIAL_CONSENT",
  "IDENTIFICATION",
  "CHALLENGE",
  "CURRENT_PROCESS",
  "IMPACT",
  "BUYING_CONTEXT",
  "REVIEW",
  "COMPLETION",
] as const;

export const PublicInterviewStageSchema = z.enum(PUBLIC_INTERVIEW_STAGES);
export type PublicInterviewStage = z.infer<typeof PublicInterviewStageSchema>;

export const PUBLIC_DIAGNOSTIC_STATUSES = [
  "IN_PROGRESS",
  "REVIEW",
  "COMPLETING",
  "COMPLETED",
  "COMPLETED_NO_CONTACT",
  "BLOCKED",
  "EXPIRED",
] as const;

export const PublicDiagnosticStatusSchema = z.enum(PUBLIC_DIAGNOSTIC_STATUSES);
export type PublicDiagnosticStatus = z.infer<typeof PublicDiagnosticStatusSchema>;

export const QuestionOptionSchema = z
  .object({
    value: z.string().min(1).max(100),
    label: z.string().min(1).max(200),
  })
  .strict();

export type QuestionOption = z.infer<typeof QuestionOptionSchema>;

export const PublicQuestionValidationSchema = z
  .object({
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().positive().max(10_000).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    maxSelections: z.number().int().positive().max(50).optional(),
    units: z.array(z.string().min(1).max(50)).max(20).optional(),
    allowUnknown: z.boolean().optional(),
  })
  .strict();

export type PublicQuestionValidation = z.infer<
  typeof PublicQuestionValidationSchema
>;

/**
 * Intentionally excludes purpose, criticality, targeting, scoring and
 * conditional rules. Those fields are server-side interview policy.
 */
export const PublicQuestionSchema = z
  .object({
    id: z.string().min(1).max(100),
    version: z.string().min(1).max(30),
    stage: QuestionStageSchema,
    text: z.string().min(1).max(500),
    responseType: ResponseTypeSchema,
    required: z.boolean(),
    options: z.array(QuestionOptionSchema).max(50).optional(),
    validation: PublicQuestionValidationSchema.optional(),
  })
  .strict();

export type PublicQuestion = z.infer<typeof PublicQuestionSchema>;

export const NumberWithUnitAnswerSchema = z
  .object({
    value: z.number().finite().nonnegative(),
    unit: z.string().min(1).max(50),
  })
  .strict();

export const UnknownAnswerSchema = z.object({ unknown: z.literal(true) }).strict();

export const PublicAnswerValueSchema = z.union([
  z.string().max(10_000),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().min(1).max(100)).max(50),
  NumberWithUnitAnswerSchema,
  UnknownAnswerSchema,
]);

export type PublicAnswerValue = z.infer<typeof PublicAnswerValueSchema>;

export const PUBLIC_PROGRESS_STAGE_IDS = [
  "IDENTIFICATION",
  "CHALLENGE",
  "CURRENT_PROCESS",
  "IMPACT",
  "BUYING_CONTEXT",
  "REVIEW",
] as const;

export const PublicProgressStageIdSchema = z.enum(PUBLIC_PROGRESS_STAGE_IDS);
export type PublicProgressStageId = z.infer<typeof PublicProgressStageIdSchema>;

export const PublicProgressItemSchema = z
  .object({
    id: PublicProgressStageIdSchema,
    label: z.string().min(1).max(80),
    status: z.enum(["UPCOMING", "CURRENT", "COMPLETED"]),
  })
  .strict();

export const PublicProgressSchema = z
  .object({
    currentStep: z.number().int().min(1).max(6),
    totalSteps: z.literal(6),
    currentLabel: z.string().min(1).max(80),
    steps: z.array(PublicProgressItemSchema).length(6),
  })
  .strict();

export type PublicProgress = z.infer<typeof PublicProgressSchema>;

export const PublicReviewSchema = z
  .object({
    version: z.number().int().positive(),
    company: z.string().max(200),
    affectedArea: z.string().max(100),
    challenge: z.string().max(800),
    currentProcess: z.string().max(1_200),
    participants: z.string().max(500),
    systems: z.array(z.string().max(100)).max(20),
    mainImpacts: z.array(z.string().max(200)).max(15),
    desiredOutcome: z.string().max(800),
    priority: z.string().max(100),
    deadline: z.string().max(300).nullable(),
    decisionContext: z.string().max(800),
    confirmed: z.boolean(),
  })
  .strict();

export type PublicReview = z.infer<typeof PublicReviewSchema>;

/**
 * This is the only state shape intended for the browser. `.strict()` is a
 * deliberate guard against accidentally serializing score, flags, evidence,
 * internal routes or commercial briefings.
 */
export const PublicDiagnosticStateSchema = z
  .object({
    diagnosticId: z.string().uuid(),
    sessionId: z.string().uuid(),
    status: PublicDiagnosticStatusSchema,
    stage: PublicInterviewStageSchema,
    currentQuestion: PublicQuestionSchema.nullable(),
    progress: PublicProgressSchema,
    review: PublicReviewSchema.nullable(),
    canGoBack: z.boolean(),
    canResume: z.boolean(),
    saveStatus: z.literal("SAVED"),
  })
  .strict();

export type PublicDiagnosticState = z.infer<typeof PublicDiagnosticStateSchema>;

export const PUBLIC_ERROR_CODES = [
  "VALIDATION_ERROR",
  "SESSION_EXPIRED",
  "SESSION_NOT_FOUND",
  "STATE_CONFLICT",
  "RATE_LIMITED",
  "AI_FALLBACK_ACTIVE",
  "PERSISTENCE_UNAVAILABLE",
  "UNAUTHORIZED",
  "BLOCKED",
  "GENERIC_ERROR",
] as const;

export const PublicErrorCodeSchema = z.enum(PUBLIC_ERROR_CODES);
export type PublicErrorCode = z.infer<typeof PublicErrorCodeSchema>;

export const PublicDiagnosticErrorSchema = z
  .object({
    code: PublicErrorCodeSchema,
    message: z.string().min(1).max(500),
    referenceCode: z.string().regex(/^[A-Z0-9]{8,24}$/),
    retryable: z.boolean(),
  })
  .strict();

export type PublicDiagnosticError = z.infer<typeof PublicDiagnosticErrorSchema>;
