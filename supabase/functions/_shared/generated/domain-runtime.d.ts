export type CanonicalAssessment = {
  version: string;
  earnedPoints: number;
  assessedWeight: number;
  normalizedScore: number | null;
  finalScore: number | null;
  scoreCapApplied: number | null;
  classification: "PRIORITY" | "QUALIFIED" | "INVESTIGATION" | "LOW_FIT" | "INSUFFICIENT";
  assessmentConfidence: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";
  criteria: Array<{
    code: string;
    dimension: string;
    maximumPoints: number;
    assessed: boolean;
    earnedPoints: number;
    evidencePaths: string[];
  }>;
};

export function calculateQualification(input: {
  structuredData: Record<string, unknown>;
  evidence: Array<Record<string, unknown>>;
}): CanonicalAssessment;

export function evaluateFlags(input: {
  state: Record<string, unknown>;
  assessment?: CanonicalAssessment;
}): Array<{
  code: string;
  displayName: string;
  category: string;
  severity: "S0" | "S1" | "S2" | "S3";
  reason: string;
  schedulingEffect: "NONE" | "BLOCK_AUTOMATIC" | "BLOCK_ALL";
}>;

export function determineInternalRoute(input: {
  privacyConsent: boolean | null;
  commercialConsent: boolean | null;
  assessment: CanonicalAssessment;
  flags: Array<Record<string, unknown>>;
}): { route: string; automaticSchedulingEligible: false; reasonCode: string };

export const DEFAULT_INTERVIEW_RULES: {
  targetQuestionsMin: number;
  targetQuestionsMax: number;
  exceptionalQuestionsMax: number;
  absoluteQuestionsMax: number;
  maxClarificationsTotal: number;
  maxAreaSpecificQuestions: number;
};

export type CanonicalNextAction =
  | { type: "ASK_QUESTION"; questionId: string }
  | { type: "ASK_CLARIFICATION"; clarification: { id: string; type: string; relatedQuestionId: string; text: string; sequence: number } }
  | { type: "GENERATE_REVIEW" }
  | { type: "SHOW_REVIEW" }
  | { type: "COMPLETE" }
  | { type: "BLOCK"; reason: string };

export function getNextInterviewAction(
  state: unknown,
  catalog: unknown,
  rules: unknown,
): CanonicalNextAction;

export type CanonicalReview = {
  company: string;
  affectedArea: string;
  challenge: string;
  currentProcess: string;
  participants: string;
  systems: string[];
  mainImpacts: string[];
  desiredOutcome: string;
  priority: string;
  deadline: string | null;
  decisionContext: string;
};

export class DeterministicInterviewAIService {
  extractAnswer(input: {
    question: Record<string, unknown>;
    answer: unknown;
    targetPaths: string[];
    knownData: Record<string, unknown>;
  }): Promise<{
    fields: Array<{
      path: string;
      value: unknown;
      sourceType: "REPORTED_FACT" | "CLIENT_ESTIMATE" | "AI_INFERENCE" | "NOT_CONFIRMED";
      confidence: number;
      evidenceText: string;
    }>;
    detectedSensitiveData: boolean;
    sensitiveDataCategories: string[];
    responseClarity: "CLEAR" | "PARTIAL" | "VAGUE";
    summary: string;
  }>;
  generateReview(input: {
    structuredData: Record<string, unknown>;
  }): Promise<CanonicalReview>;
  generateBriefing(input: {
    structuredData: Record<string, unknown>;
    review: Record<string, unknown>;
    missingCriticalPaths: string[];
  }): Promise<{
    executiveSummary: string;
    challengeSummary: string;
    currentProcessSummary: string;
    impactSummary: string;
    buyingContextSummary: string;
    technicalContextSummary: string;
    initialHypotheses: Array<Record<string, unknown>>;
    missingInformation: string[];
    recommendedQuestions: string[];
    recommendedParticipants: string[];
  }>;
}
