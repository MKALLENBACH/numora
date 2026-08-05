import type {
  EmployeeRange,
  GeneratedReview,
  Industry,
  PublicAnswerValue,
  QuestionOption,
  QuestionStage,
  ResponseType,
  RevenueRange,
} from "../contracts";

export const DIAGNOSTIC_STATUSES = [
  "INTRODUCTION",
  "PRIVACY_CONSENT",
  "COMMERCIAL_CONSENT",
  "IDENTIFICATION",
  "CHALLENGE",
  "CURRENT_PROCESS",
  "IMPACT",
  "BUYING_CONTEXT",
  "REVIEW_GENERATING",
  "REVIEW_PENDING",
  "REVIEW_EDITING",
  "COMPLETING",
  "COMPLETED",
  "COMPLETED_NO_CONTACT",
  "BLOCKED",
  "EXPIRED",
  "ABANDONED",
] as const;

export type DiagnosticStatus = (typeof DIAGNOSTIC_STATUSES)[number];

export const SCORING_DIMENSIONS = [
  "NUMORA_FIT",
  "PROBLEM_CLARITY",
  "OPERATIONAL_IMPACT",
  "FINANCIAL_IMPACT",
  "URGENCY",
  "DECISION_AND_EXECUTION",
  "DATA_AND_FEASIBILITY",
] as const;

export type ScoringDimension = (typeof SCORING_DIMENSIONS)[number];

export type QuestionValidation = {
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly min?: number;
  readonly max?: number;
  readonly maxSelections?: number;
  readonly units?: readonly string[];
  readonly allowUnknown?: boolean;
};

export type QuestionCondition =
  | {
      readonly type: "ALL" | "ANY";
      readonly conditions: readonly QuestionCondition[];
    }
  | { readonly type: "NOT"; readonly condition: QuestionCondition }
  | {
      readonly type: "ANSWER_EQUALS";
      readonly questionId: string;
      readonly value: string | number | boolean;
    }
  | {
      readonly type: "ANSWER_INCLUDES";
      readonly questionId: string;
      readonly value: string;
    }
  | {
      readonly type: "ANSWER_ARRAY_MIN_LENGTH";
      readonly questionId: string;
      readonly minimum: number;
    }
  | { readonly type: "FIELD_PRESENT"; readonly path: string }
  | { readonly type: "FIELD_MISSING"; readonly path: string }
  | {
      readonly type: "FIELD_IN";
      readonly path: string;
      readonly values: readonly (string | number | boolean)[];
    }
  | { readonly type: "SIGNAL_PRESENT"; readonly signal: DiagnosticSignal }
  | { readonly type: "QUESTION_COUNT_BELOW"; readonly limit: number }
  | { readonly type: "AREA_EQUALS"; readonly area: ProblemArea };

export type InterviewQuestionKind = "CORE" | "AREA_SPECIFIC";

export type InterviewQuestion = {
  readonly id: string;
  readonly version: string;
  readonly stage: QuestionStage;
  readonly text: string;
  readonly purpose: string;
  readonly responseType: ResponseType;
  readonly required: boolean;
  readonly critical: boolean;
  readonly options?: readonly QuestionOption[];
  readonly validation?: QuestionValidation;
  readonly displayCondition?: QuestionCondition;
  readonly maxClarifications: number;
  readonly targetPaths: readonly string[];
  readonly scoringDimensions: readonly ScoringDimension[];
  readonly priority: number;
  readonly kind: InterviewQuestionKind;
  readonly defaultClarificationType?: ClarificationType;
};

export type InterviewCatalog = {
  readonly version: string;
  readonly questions: readonly InterviewQuestion[];
  readonly criticalPaths: readonly string[];
};

export const PROBLEM_AREAS = [
  "COMMERCIAL",
  "FINANCE",
  "CUSTOMER_SERVICE",
  "OPERATIONS_LOGISTICS",
  "PROCUREMENT",
  "HUMAN_RESOURCES",
  "LEGAL",
  "TECHNOLOGY",
  "OTHER",
] as const;

export type ProblemArea = (typeof PROBLEM_AREAS)[number];

export type LeadData = {
  readonly name?: string;
  readonly role?: string;
  readonly company?: string;
  readonly email?: string;
  readonly industry?: Industry;
  readonly industryOther?: string;
  readonly employeeRange?: EmployeeRange;
  readonly phone?: string;
  readonly revenueRange?: RevenueRange;
  readonly decisionInfluence?: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
};

export type ChallengeData = {
  readonly summary?: string;
  readonly primaryAffectedArea?: ProblemArea;
  readonly process?: string;
  readonly symptoms?: readonly string[];
  readonly desiredOutcome?: string;
  readonly existingSince?: string;
  readonly previousAttempts?: boolean;
  readonly previousAttemptDetails?: string;
};

export type CurrentProcessData = {
  readonly description?: string;
  readonly participants?: string;
  readonly participantCount?: number;
  readonly involvedAreas?: readonly string[];
  readonly systems?: readonly string[];
  readonly systemOther?: string;
  readonly frequency?: string;
  readonly monthlyVolume?: number | "UNKNOWN";
  readonly averageExecutionTime?: {
    readonly value: number;
    readonly unit: string;
  };
  readonly duplicateDataEntry?: boolean;
  readonly manualDependency?: string;
};

export type ImpactData = {
  readonly categories?: readonly string[];
  readonly issueFrequency?: string;
  readonly reportedHours?: {
    readonly value: number;
    readonly unit: string;
  };
  readonly reportedFinancialImpact?: string;
  readonly externalStakeholdersAffected?: boolean;
  readonly externalStakeholderDescription?: string;
  readonly riskOfInaction?: string;
};

export type BuyingContextData = {
  readonly priority?: number;
  readonly deadline?: string;
  readonly budgetStatus?: string;
  readonly internalOwnerExists?: boolean;
  readonly internalOwnerArea?: string;
  readonly decisionMakers?: readonly string[];
  readonly processRedesignOpenness?: string;
};

export type TechnicalContextData = {
  readonly dataAvailability?: string;
  readonly itAvailability?: string;
  readonly integrationLikely?: boolean;
};

export type DiagnosticStructuredData = {
  readonly lead: LeadData;
  readonly challenge: ChallengeData;
  readonly currentProcess: CurrentProcessData;
  readonly impact: ImpactData;
  readonly buyingContext: BuyingContextData;
  readonly technicalContext: TechnicalContextData;
};

export const EVIDENCE_SOURCE_TYPES = [
  "REPORTED_FACT",
  "CLIENT_ESTIMATE",
  "AI_INFERENCE",
  "SYSTEM_DERIVED",
  "NOT_CONFIRMED",
] as const;

export type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number];

export type EvidenceRecord = {
  readonly path: string;
  readonly sourceType: EvidenceSourceType;
  readonly confidence: number;
  readonly answerId: string;
  readonly questionId: string;
  readonly evidenceText?: string;
  /** Revision of the source answer, when persisted with version metadata. */
  readonly revision?: number;
  /** Explicitly false when a newer answer/evidence superseded this record. */
  readonly isCurrent?: boolean;
};

export type AnswerClarity = "CLEAR" | "PARTIAL" | "VAGUE";

export type AnswerRecord = {
  readonly id: string;
  readonly questionId: string;
  readonly questionVersion: string;
  readonly value: PublicAnswerValue;
  readonly clarity: AnswerClarity;
  readonly revision: number;
  readonly answeredAtEpochMs: number;
  readonly needsClarification?: boolean;
  readonly clarificationType?: ClarificationType;
};

export const CLARIFICATION_TYPES = [
  "VAGUE_PROBLEM",
  "AREA_WITHOUT_PROCESS",
  "GENERIC_AI_REQUEST",
  "GENERIC_AUTOMATION_REQUEST",
  "INCOMPLETE_PROCESS",
  "IMPACT_MISSING",
  "CONTRADICTION",
] as const;

export type ClarificationType = (typeof CLARIFICATION_TYPES)[number];

export type ClarificationQuestion = {
  readonly id: string;
  readonly type: ClarificationType;
  readonly relatedQuestionId: string;
  readonly text: string;
  readonly sequence: number;
};

export type ClarificationRecord = ClarificationQuestion & {
  readonly answered: boolean;
};

export const DIAGNOSTIC_SIGNALS = [
  "VAGUE_PROBLEM",
  "AREA_WITHOUT_PROCESS",
  "GENERIC_AI_REQUEST",
  "GENERIC_AUTOMATION_REQUEST",
  "INCOMPLETE_PROCESS",
  "IMPACT_MISSING",
  "CONTRADICTION",
  "DUPLICATE_DATA_ENTRY",
  "MANUAL_PROCESS",
  "MULTIPLE_SYSTEMS",
  "HIGH_VOLUME",
  "FINANCIAL_IMPACT",
  "EXTERNAL_STAKEHOLDER_IMPACT",
  "INTEGRATION_LIKELY",
  "TOOL_ONLY_REQUEST",
  "AUTOMATION_ONLY_EXPECTATION",
  "STAFF_AUGMENTATION_EXPECTATION",
  "FREE_WORK_EXPECTATION",
  "FREE_WORK_REQUIREMENT",
  "COMPLETELY_OUT_OF_SCOPE",
  "RESEARCH_ONLY",
  "CONTRADICTORY_INFORMATION",
  "SENSITIVE_DATA_SHARED",
  "SEVERE_SENSITIVE_DATA_EXPOSURE",
  "PROMPT_INJECTION_ATTEMPT",
  "PERSISTENT_PROMPT_INJECTION",
  "PERSISTENT_ABUSE",
  "SPAM_OR_BOT",
  "FRAUD_SUSPECTED",
  "ILLEGAL_REQUEST",
  "IDENTITY_EVIDENTLY_FALSE",
  "AI_EXTRACTION_FAILURE",
  "AI_PROVIDER_UNAVAILABLE",
  "DATABASE_PERSISTENCE_FAILURE",
] as const;

export type DiagnosticSignal = (typeof DIAGNOSTIC_SIGNALS)[number];

export type DiagnosticState = {
  readonly status: DiagnosticStatus;
  readonly privacyConsent: boolean | null;
  readonly commercialConsent: boolean | null;
  readonly privacyConsentVersion?: string;
  readonly commercialConsentVersion?: string;
  readonly identificationComplete: boolean;
  readonly structuredData: DiagnosticStructuredData;
  readonly answers: readonly AnswerRecord[];
  readonly askedQuestionIds: readonly string[];
  readonly clarifications: readonly ClarificationRecord[];
  readonly evidence: readonly EvidenceRecord[];
  readonly signals: readonly DiagnosticSignal[];
  readonly review: GeneratedReview | null;
  readonly reviewConfirmed: boolean;
  readonly reviewCycles: number;
  readonly startedAtEpochMs: number;
  readonly expiresAtEpochMs: number;
  readonly currentTimeEpochMs: number;
};

export type InterviewRules = {
  readonly targetQuestionsMin: number;
  readonly targetQuestionsMax: number;
  readonly exceptionalQuestionsMax: number;
  readonly absoluteQuestionsMax: number;
  readonly maxClarificationsTotal: number;
  readonly maxAreaSpecificQuestions: number;
};

export const BLOCKING_REASONS = [
  "PRIVACY_NOT_ACCEPTED",
  "SESSION_EXPIRED",
  "SEVERE_SENSITIVE_DATA_EXPOSURE",
  "PERSISTENT_PROMPT_INJECTION",
  "PERSISTENT_ABUSE",
  "ILLEGAL_REQUEST",
  "COMPLETELY_OUT_OF_SCOPE",
  "SYSTEM_BLOCKED",
] as const;

export type BlockingReason = (typeof BLOCKING_REASONS)[number];

export type NextInterviewAction =
  | { readonly type: "ASK_QUESTION"; readonly questionId: string }
  | {
      readonly type: "ASK_CLARIFICATION";
      readonly clarification: ClarificationQuestion;
    }
  | { readonly type: "GENERATE_REVIEW" }
  | { readonly type: "SHOW_REVIEW" }
  | { readonly type: "COMPLETE" }
  | { readonly type: "BLOCK"; readonly reason: BlockingReason };

export type AssessmentConfidence =
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "INSUFFICIENT";

export type QualificationClassification =
  | "PRIORITY"
  | "QUALIFIED"
  | "INVESTIGATION"
  | "LOW_FIT"
  | "INSUFFICIENT";

export type ScoreCriterionResult = {
  readonly code: string;
  readonly dimension: ScoringDimension;
  readonly maximumPoints: number;
  readonly assessed: boolean;
  readonly earnedPoints: number;
  readonly evidencePaths: readonly string[];
};

export type QualificationAssessment = {
  readonly version: string;
  readonly earnedPoints: number;
  readonly assessedWeight: number;
  readonly normalizedScore: number | null;
  readonly finalScore: number | null;
  readonly scoreCapApplied: number | null;
  readonly classification: QualificationClassification;
  readonly assessmentConfidence: AssessmentConfidence;
  readonly criteria: readonly ScoreCriterionResult[];
};

export const FLAG_SEVERITIES = ["S0", "S1", "S2", "S3"] as const;
export type FlagSeverity = (typeof FLAG_SEVERITIES)[number];

export type DiagnosticFlag = {
  readonly code: DiagnosticFlagCode;
  readonly displayName: string;
  readonly category:
    | "CONSENT"
    | "DATA"
    | "FIT"
    | "MATURITY"
    | "TECHNICAL"
    | "COMPLEXITY"
    | "SECURITY"
    | "SYSTEM";
  readonly severity: FlagSeverity;
  readonly reason: string;
  readonly schedulingEffect: "NONE" | "BLOCK_AUTOMATIC" | "BLOCK_ALL";
};

export const DIAGNOSTIC_FLAG_CODES = [
  "PRIVACY_NOT_ACCEPTED",
  "COMMERCIAL_CONTACT_NOT_ACCEPTED",
  "CONSENT_VERSION_MISSING",
  "PERSONAL_EMAIL",
  "TEMPORARY_EMAIL",
  "PHONE_NOT_PROVIDED",
  "PROBLEM_UNCLEAR",
  "CONTRADICTORY_INFORMATION",
  "INSUFFICIENT_INFORMATION",
  "HIGH_IMPACT_LOW_INFORMATION",
  "LOW_RESPONSE_CONFIDENCE",
  "REVIEW_NOT_CONFIRMED",
  "TOOL_ONLY_REQUEST",
  "AUTOMATION_ONLY_EXPECTATION",
  "LOW_METHODOLOGY_FIT",
  "STAFF_AUGMENTATION_EXPECTATION",
  "FREE_WORK_EXPECTATION",
  "FREE_WORK_REQUIREMENT",
  "COMPLETELY_OUT_OF_SCOPE",
  "LOW_OPERATIONAL_COMPLEXITY",
  "RESEARCH_ONLY",
  "NO_INTERNAL_OWNER",
  "OWNER_UNDEFINED",
  "DECISION_PROCESS_UNDEFINED",
  "NO_EXECUTIVE_SPONSOR",
  "BUDGET_UNDEFINED",
  "BUDGET_REJECTED",
  "LOW_URGENCY",
  "DEADLINE_INCONSISTENT",
  "LIMITED_DATA",
  "DATA_FRAGMENTED",
  "NO_DATA_AVAILABLE",
  "SYSTEMS_NOT_IDENTIFIED",
  "INTEGRATION_FEASIBILITY_UNKNOWN",
  "NO_IT_AVAILABILITY",
  "IT_AVAILABILITY_UNKNOWN",
  "LEGACY_SYSTEM_DEPENDENCY",
  "MANUAL_PROCESS_WITHOUT_RECORDS",
  "STRATEGIC_ENTERPRISE",
  "MULTI_AREA_TRANSFORMATION",
  "HIGH_REGULATORY_RISK",
  "SECURITY_RELEVANT_PROJECT",
  "UNUSUAL_TECHNICAL_COMPLEXITY",
  "CRITICAL_OPERATION",
  "HIGH_EXPECTED_IMPACT",
  "SENSITIVE_DATA_SHARED",
  "SEVERE_SENSITIVE_DATA_EXPOSURE",
  "PROMPT_INJECTION_ATTEMPT",
  "PERSISTENT_PROMPT_INJECTION",
  "PERSISTENT_ABUSE",
  "SPAM_OR_BOT",
  "FRAUD_SUSPECTED",
  "ILLEGAL_REQUEST",
  "IDENTITY_EVIDENTLY_FALSE",
  "AI_EXTRACTION_FAILURE",
  "AI_PROVIDER_UNAVAILABLE",
  "DATABASE_PERSISTENCE_FAILURE",
] as const;

export type DiagnosticFlagCode = (typeof DIAGNOSTIC_FLAG_CODES)[number];

export const INTERNAL_ROUTES = [
  "SENIOR_MEETING",
  "STANDARD_MEETING",
  "EXPLORATORY_MEETING",
  "MANUAL_REVIEW",
  "NURTURE",
  "OUT_OF_SCOPE",
  "BLOCKED",
  "NO_CONTACT",
] as const;

export type InternalRoute = (typeof INTERNAL_ROUTES)[number];

export type RouteDecision = {
  readonly route: InternalRoute;
  readonly automaticSchedulingEligible: false;
  readonly reasonCode: string;
};
