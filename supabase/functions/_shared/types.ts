import type { SupabaseClient, User } from "@supabase/supabase-js";

export type EndpointName =
  | "diagnostic-start"
  | "diagnostic-consent"
  | "diagnostic-identification"
  | "diagnostic-state"
  | "diagnostic-submit-answer"
  | "diagnostic-next-action"
  | "diagnostic-generate-review"
  | "diagnostic-update-review"
  | "diagnostic-confirm-review"
  | "diagnostic-complete"
  | "diagnostic-abandon";

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export type RequestContext = {
  user: User;
  admin: SupabaseClient;
  origin: string | null;
  referenceCode: string;
};

export type PublicQuestion = {
  id: string;
  version: string;
  stage: "CHALLENGE" | "CURRENT_PROCESS" | "IMPACT" | "BUYING_CONTEXT";
  text: string;
  responseType:
    | "SHORT_TEXT" | "LONG_TEXT" | "SINGLE_CHOICE" | "MULTIPLE_CHOICE"
    | "NUMBER" | "NUMBER_WITH_UNIT" | "CURRENCY_RANGE" | "DATE"
    | "YES_NO" | "SCALE" | "CONFIRMATION";
  required: boolean;
  options?: Array<{ value: string; label: string }>;
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    maxSelections?: number;
    units?: string[];
    allowUnknown?: boolean;
  };
};

export type PublicDiagnosticState = {
  diagnosticId: string;
  sessionId: string;
  status: "IN_PROGRESS" | "REVIEW" | "COMPLETING" | "COMPLETED" | "COMPLETED_NO_CONTACT" | "BLOCKED" | "EXPIRED";
  stage:
    | "INTRODUCTION" | "PRIVACY_CONSENT" | "COMMERCIAL_CONSENT" | "IDENTIFICATION"
    | "CHALLENGE" | "CURRENT_PROCESS" | "IMPACT" | "BUYING_CONTEXT" | "REVIEW" | "COMPLETION";
  currentQuestion: PublicQuestion | null;
  progress: {
    currentStep: number;
    totalSteps: 6;
    currentLabel: string;
    steps: Array<{
      id: "IDENTIFICATION" | "CHALLENGE" | "CURRENT_PROCESS" | "IMPACT" | "BUYING_CONTEXT" | "REVIEW";
      label: string;
      status: "UPCOMING" | "CURRENT" | "COMPLETED";
    }>;
  };
  review: ({ version: number; confirmed: boolean } & Record<string, Json>) | null;
  canGoBack: boolean;
  canResume: boolean;
  saveStatus: "SAVED";
};

export type Redaction = {
  category: "PASSWORD" | "TOKEN" | "API_KEY" | "PRIVATE_KEY" | "CPF" | "CARD" | "BANK_ACCOUNT" | "CREDENTIAL" | "OTHER_SECRET";
  fieldPath: string;
  fingerprint: string;
  severe: boolean;
};
