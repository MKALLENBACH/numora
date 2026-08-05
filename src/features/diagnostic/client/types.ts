import type {
  PublicAnswerValue,
  PublicDiagnosticState as ContractPublicDiagnosticState,
  PublicDiagnosticStatus,
  PublicInterviewStage,
  PublicProgress as ContractPublicProgress,
  PublicQuestion as ContractPublicQuestion,
  PublicReview as ContractPublicReview,
  QuestionOption as ContractQuestionOption,
  ResponseType as ContractResponseType,
} from "@/features/diagnostic/contracts/public";

export type DiagnosticStatus = PublicDiagnosticStatus;
export type InterviewStage = PublicInterviewStage;
export type ResponseType = ContractResponseType;
export type QuestionOption = ContractQuestionOption;
export type PublicQuestion = ContractPublicQuestion;
export type PublicProgress = ContractPublicProgress;
export type PublicReview = ContractPublicReview;
export type PublicDiagnosticState = ContractPublicDiagnosticState;

export type ReviewSection = {
  key: string;
  title: string;
  value: string;
  editable?: boolean;
};

export type PreviousAnswer = {
  questionCode: string;
  question: string;
  displayValue: string;
};

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "paused";

export type DiagnosticErrorCode =
  | "CONFIGURATION_ERROR"
  | "VALIDATION_ERROR"
  | "SESSION_EXPIRED"
  | "SESSION_NOT_FOUND"
  | "STATE_CONFLICT"
  | "RATE_LIMITED"
  | "AI_FALLBACK_ACTIVE"
  | "PERSISTENCE_UNAVAILABLE"
  | "UNAUTHORIZED"
  | "BLOCKED"
  | "GENERIC_ERROR";

export type PublicApiError = {
  code: DiagnosticErrorCode;
  message: string;
  referenceCode?: string;
  retryable?: boolean;
};

export type IdentificationValues = {
  name: string;
  role: string;
  company: string;
  email: string;
  industry: string;
  industryOther: string;
  companySize: string;
  phone: string;
  revenueRange: string;
  website: string;
};

export type AnswerValue = PublicAnswerValue | null;

export type LocalDraft = {
  diagnosticId: string;
  questionCode: string;
  value: AnswerValue;
  displayValue: string;
  clientRequestId: string;
  startedAt: string;
  updatedAt: string;
};
