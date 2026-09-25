import { z } from "zod";

const ADMIN_DIAGNOSTIC_STATUSES = [
  "INTRODUCTION", "PRIVACY_CONSENT", "COMMERCIAL_CONSENT", "IDENTIFICATION",
  "CHALLENGE", "CURRENT_PROCESS", "IMPACT", "BUYING_CONTEXT",
  "REVIEW_GENERATING", "REVIEW_PENDING", "REVIEW_EDITING", "COMPLETING",
  "COMPLETED", "COMPLETED_NO_CONTACT", "BLOCKED", "EXPIRED", "ABANDONED",
] as const;

export const ADMIN_DIAGNOSTIC_DETAIL_SECTIONS = [
  "OVERVIEW",
  "INTERVIEW",
  "QUALIFICATION",
  "FLAGS",
  "BRIEFING",
  "AUDIT",
] as const;

export const ADMIN_DIAGNOSTIC_TABS = [
  "visao-geral",
  "entrevista",
  "qualificacao",
  "flags",
  "briefing",
  "auditoria",
] as const;

const IsoDateSchema = z.iso.datetime({ offset: true });
const NullableTextSchema = z.string().nullable();

export const AdminDiagnosticDetailRequestSchema = z.object({
  diagnosticId: z.uuid(),
  section: z.enum(ADMIN_DIAGNOSTIC_DETAIL_SECTIONS),
}).strict();

const DetailMetaSchema = z.object({
  diagnosticId: z.uuid(),
  diagnosticStatus: z.enum(ADMIN_DIAGNOSTIC_STATUSES),
  companyName: z.string().max(200).nullable(),
  finalScore: z.number().int().min(0).max(100).nullable(),
  classification: z.enum([
    "PRIORITY", "QUALIFIED", "INVESTIGATION", "LOW_FIT", "INSUFFICIENT",
  ]).nullable(),
  contactAllowed: z.boolean(),
  createdAt: IsoDateSchema,
  completedAt: IsoDateSchema.nullable(),
  rowVersion: z.number().int().min(1),
  currentAssessmentId: z.uuid().nullable(),
  currentBriefingId: z.uuid().nullable(),
}).strict();

const ConsentSchema = z.object({
  decision: z.enum(["ACCEPTED", "DECLINED"]),
  policyVersion: z.string().max(100),
  occurredAt: IsoDateSchema,
}).strict();

const AssessmentSummarySchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  finalScore: z.number().int().min(0).max(100).nullable(),
  normalizedScore: z.number().min(0).max(100).nullable(),
  classification: z.enum([
    "PRIORITY", "QUALIFIED", "INVESTIGATION", "LOW_FIT", "INSUFFICIENT",
  ]),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW", "INSUFFICIENT"]),
  assessedWeight: z.number().min(0).max(100),
  scoreCapApplied: z.number().int().min(0).max(100).nullable(),
  calculatedAt: IsoDateSchema,
}).strict();

const OverviewContentSchema = z.object({
  diagnostic: z.object({
    status: z.enum(ADMIN_DIAGNOSTIC_STATUSES),
    currentStage: z.string().max(40),
    completionPercentage: z.number().min(0).max(100),
    schemaVersion: z.string().max(30),
    interviewVersion: z.string().max(30),
    createdAt: IsoDateSchema,
    updatedAt: IsoDateSchema,
    completedAt: IsoDateSchema.nullable(),
  }).strict(),
  company: z.object({
    name: z.string().max(200),
    industry: z.string().max(100),
    industryOther: z.string().max(200).nullable(),
    employeeRange: z.string().max(50).nullable(),
    revenueRange: z.string().max(50).nullable(),
  }).strict().nullable(),
  contact: z.object({
    name: z.string().max(150),
    role: z.string().max(150),
    roleCategory: z.string().max(80).nullable(),
    email: z.string().max(320),
    emailType: z.string().max(40),
    emailValidated: z.boolean(),
    phone: z.string().max(30).nullable(),
  }).strict().nullable(),
  privacyConsent: ConsentSchema.nullable(),
  commercialConsent: ConsentSchema.nullable(),
  contactAllowed: z.boolean(),
  privacyRestricted: z.boolean(),
  primaryArea: z.string().max(100).nullable(),
  declaredPriority: z.number().int().min(1).max(5).nullable(),
  executiveSummary: z.string().max(2_000).nullable(),
  assessment: AssessmentSummarySchema.nullable(),
  highestActiveFlag: z.object({
    code: z.string().max(100),
    displayName: z.string().max(200),
    severity: z.enum(["S0", "S1", "S2", "S3"]),
  }).strict().nullable(),
}).strict();

const ReviewSummarySchema = z.object({
  company: NullableTextSchema,
  affectedArea: NullableTextSchema,
  challenge: NullableTextSchema,
  currentProcess: NullableTextSchema,
  participants: NullableTextSchema,
  systems: z.array(z.string().max(500)).max(50),
  mainImpacts: z.array(z.string().max(500)).max(50),
  desiredOutcome: NullableTextSchema,
  priority: NullableTextSchema,
  deadline: NullableTextSchema,
  decisionContext: NullableTextSchema,
}).strict();

const InterviewContentSchema = z.object({
  privacyRestricted: z.boolean(),
  identification: z.object({
    companyName: z.string().max(200).nullable(),
    contactName: z.string().max(150).nullable(),
    contactRole: z.string().max(150).nullable(),
    industry: z.string().max(100).nullable(),
    employeeRange: z.string().max(50).nullable(),
  }).strict(),
  sessions: z.array(z.object({
    id: z.uuid(),
    status: z.string().max(40),
    currentStage: z.string().max(40),
    startedAt: IsoDateSchema,
    lastActivityAt: IsoDateSchema,
    completedAt: IsoDateSchema.nullable(),
    totalQuestionCount: z.number().int().nonnegative(),
    clarificationCount: z.number().int().nonnegative(),
  }).strict()).max(100),
  answers: z.array(z.object({
    id: z.uuid(),
    sessionId: z.uuid(),
    questionCode: z.string().max(100),
    questionVersion: z.string().max(30),
    responseType: z.string().max(40),
    displayValue: z.string().max(10_000).nullable(),
    normalizedFields: z.array(z.object({
      path: z.string().max(300),
      value: z.string().max(10_000),
    }).strict()).max(100),
    validationStatus: z.string().max(40),
    sourceType: z.string().max(40),
    confidence: z.number().min(0).max(1),
    confirmed: z.boolean(),
    revision: z.number().int().positive(),
    isCurrent: z.boolean(),
    skipReason: z.string().max(500).nullable(),
    redacted: z.boolean(),
    clarificationForCode: z.string().max(100).nullable(),
    createdAt: IsoDateSchema,
  }).strict()).max(500),
  review: z.object({
    id: z.uuid(),
    version: z.number().int().positive(),
    status: z.enum(["DRAFT", "PENDING_CONFIRMATION", "CONFIRMED", "SUPERSEDED"]),
    generatedAt: IsoDateSchema,
    confirmedAt: IsoDateSchema.nullable(),
    revisionCount: z.number().int().min(0).max(3),
    summary: ReviewSummarySchema,
  }).strict().nullable(),
  reviewHistory: z.array(z.object({
    id: z.uuid(),
    version: z.number().int().positive(),
    status: z.enum(["DRAFT", "PENDING_CONFIRMATION", "CONFIRMED", "SUPERSEDED"]),
    generatedAt: IsoDateSchema,
    confirmedAt: IsoDateSchema.nullable(),
  }).strict()).max(25),
  truncated: z.boolean(),
}).strict();

const QualificationContentSchema = z.object({
  current: z.object({
    id: z.uuid(),
    version: z.number().int().positive(),
    earnedPoints: z.number().min(0).max(100),
    assessedWeight: z.number().min(0).max(100),
    normalizedScore: z.number().min(0).max(100).nullable(),
    finalScore: z.number().int().min(0).max(100).nullable(),
    scoreCapApplied: z.number().int().min(0).max(100).nullable(),
    classification: z.string().max(40),
    confidence: z.string().max(40),
    recommendedRoute: z.string().max(40),
    automaticSchedulingEligible: z.boolean(),
    calculatedAt: IsoDateSchema,
    dimensions: z.array(z.object({
      code: z.string().max(100),
      earnedPoints: z.number().nonnegative(),
      assessedWeight: z.number().nonnegative(),
      maxWeight: z.number().positive(),
      criteria: z.array(z.object({
        code: z.string().max(100),
        earnedPoints: z.number().nonnegative(),
        assessedWeight: z.number().nonnegative(),
        maxWeight: z.number().positive(),
        rationale: z.string().max(1_000).nullable(),
        evidence: z.array(z.object({
          id: z.uuid(),
          text: z.string().max(500).nullable(),
          targetPath: z.string().max(300),
          sourceType: z.string().max(40),
          confidence: z.number().min(0).max(1),
          confirmed: z.boolean(),
          redacted: z.boolean(),
        }).strict()).max(100),
      }).strict()).max(100),
    }).strict()).max(20),
  }).strict().nullable(),
  history: z.array(AssessmentSummarySchema).max(25),
  inconsistentCurrentReference: z.boolean(),
}).strict();

const FlagSchema = z.object({
  id: z.uuid(),
  code: z.string().max(100),
  displayName: z.string().max(200),
  category: z.string().max(100),
  severity: z.enum(["S0", "S1", "S2", "S3"]),
  status: z.enum(["ACTIVE", "RESOLVED"]),
  source: z.enum(["SYSTEM", "RULE", "AI_AUXILIARY", "MANUAL"]),
  reason: z.string().max(1_000).nullable(),
  triggerQuestionCode: z.string().max(100).nullable(),
  schedulingEffect: z.enum(["NONE", "BLOCK_AUTOMATIC", "BLOCK_ALL"]),
  recommendedRoute: z.string().max(40).nullable(),
  scoreEffect: z.number(),
  resolutionCondition: z.string().max(1_000).nullable(),
  triggeredAt: IsoDateSchema,
  resolvedAt: IsoDateSchema.nullable(),
  updatedAt: IsoDateSchema,
}).strict();

const FlagsContentSchema = z.object({
  privacyRestricted: z.boolean(),
  active: z.array(FlagSchema).max(100),
  resolved: z.array(FlagSchema).max(100),
  history: z.array(z.object({
    id: z.uuid(),
    flagId: z.uuid(),
    flagCode: z.string().max(100),
    eventType: z.enum(["TRIGGERED", "UPDATED", "RESOLVED"]),
    previousStatus: z.enum(["ACTIVE", "RESOLVED"]).nullable(),
    newStatus: z.enum(["ACTIVE", "RESOLVED"]),
    reason: z.string().max(1_000).nullable(),
    createdAt: IsoDateSchema,
  }).strict()).max(100),
  truncated: z.boolean(),
}).strict();

const BriefingRecordSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  status: z.enum(["DRAFT", "FINAL", "SUPERSEDED"]),
  generatedAt: IsoDateSchema,
  executiveSummary: z.string().max(2_000).nullable(),
  challengeSummary: z.string().max(1_500).nullable(),
  currentProcessSummary: z.string().max(2_000).nullable(),
  impactSummary: z.string().max(1_500).nullable(),
  buyingContextSummary: z.string().max(1_500).nullable(),
  technicalContextSummary: z.string().max(1_500).nullable(),
  initialHypotheses: z.array(z.string().max(1_000)).max(100),
  missingInformation: z.array(z.string().max(1_000)).max(100),
  recommendedQuestions: z.array(z.string().max(1_000)).max(100),
  recommendedParticipants: z.array(z.string().max(500)).max(100),
  recommendedOffer: z.string().max(50),
}).strict();

const BriefingContentSchema = z.object({
  privacyRestricted: z.boolean(),
  current: BriefingRecordSchema.nullable(),
  history: z.array(z.object({
    id: z.uuid(),
    version: z.number().int().positive(),
    status: z.enum(["DRAFT", "FINAL", "SUPERSEDED"]),
    generatedAt: IsoDateSchema,
    isCurrent: z.boolean(),
  }).strict()).max(25),
  inconsistentCurrentReference: z.boolean(),
  originRecorded: z.literal(false),
}).strict();

const AuditContentSchema = z.object({
  events: z.array(z.object({
    id: z.uuid(),
    eventType: z.string().max(100),
    actorType: z.enum(["ANONYMOUS_USER", "SYSTEM", "SERVICE"]),
    questionCode: z.string().max(100).nullable(),
    version: z.number().int().nullable(),
    consentType: z.string().max(40).nullable(),
    decision: z.string().max(40).nullable(),
    occurredAt: IsoDateSchema,
  }).strict()).max(100),
  truncated: z.boolean(),
}).strict();

export const AdminDiagnosticDetailDataSchema = z.discriminatedUnion("section", [
  z.object({ section: z.literal("OVERVIEW"), meta: DetailMetaSchema, content: OverviewContentSchema }).strict(),
  z.object({ section: z.literal("INTERVIEW"), meta: DetailMetaSchema, content: InterviewContentSchema }).strict(),
  z.object({ section: z.literal("QUALIFICATION"), meta: DetailMetaSchema, content: QualificationContentSchema }).strict(),
  z.object({ section: z.literal("FLAGS"), meta: DetailMetaSchema, content: FlagsContentSchema }).strict(),
  z.object({ section: z.literal("BRIEFING"), meta: DetailMetaSchema, content: BriefingContentSchema }).strict(),
  z.object({ section: z.literal("AUDIT"), meta: DetailMetaSchema, content: AuditContentSchema }).strict(),
]);

export type AdminDiagnosticDetailRequest = z.infer<typeof AdminDiagnosticDetailRequestSchema>;
export type AdminDiagnosticDetailData = z.infer<typeof AdminDiagnosticDetailDataSchema>;
export type AdminDiagnosticDetailSection = AdminDiagnosticDetailRequest["section"];
export type AdminDiagnosticTab = (typeof ADMIN_DIAGNOSTIC_TABS)[number];
