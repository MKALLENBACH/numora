import type {
  DiagnosticFlag,
  QualificationAssessment,
  RouteDecision,
} from "./types";

export type RouteEvaluationInput = {
  readonly privacyConsent: boolean | null;
  readonly commercialConsent: boolean | null;
  readonly flags: readonly DiagnosticFlag[];
  readonly assessment: QualificationAssessment;
};

const hasFlag = (
  flags: readonly DiagnosticFlag[],
  ...codes: readonly DiagnosticFlag["code"][]
): boolean => flags.some((flag) => codes.includes(flag.code));

/**
 * Internal-only route policy. Automatic scheduling is deliberately always
 * disabled because scheduling is outside the MVP.
 */
export function determineInternalRoute(
  input: RouteEvaluationInput,
): RouteDecision {
  if (
    input.privacyConsent === false ||
    hasFlag(
      input.flags,
      "PRIVACY_NOT_ACCEPTED",
      "ILLEGAL_REQUEST",
      "SEVERE_SENSITIVE_DATA_EXPOSURE",
      "PERSISTENT_PROMPT_INJECTION",
      "PERSISTENT_ABUSE",
      "FRAUD_SUSPECTED",
    )
  ) {
    return {
      route: "BLOCKED",
      automaticSchedulingEligible: false,
      reasonCode: "BLOCKING_CONDITION",
    };
  }

  if (hasFlag(input.flags, "COMPLETELY_OUT_OF_SCOPE")) {
    return {
      route: "OUT_OF_SCOPE",
      automaticSchedulingEligible: false,
      reasonCode: "CONFIRMED_OUT_OF_SCOPE",
    };
  }

  if (input.commercialConsent === false) {
    return {
      route: "NO_CONTACT",
      automaticSchedulingEligible: false,
      reasonCode: "COMMERCIAL_CONTACT_NOT_ACCEPTED",
    };
  }

  if (
    input.flags.some((flag) => flag.severity === "S2") ||
    input.assessment.assessmentConfidence === "INSUFFICIENT" ||
    input.assessment.finalScore === null
  ) {
    return {
      route: "MANUAL_REVIEW",
      automaticSchedulingEligible: false,
      reasonCode: "MANUAL_REVIEW_REQUIRED",
    };
  }

  const score = input.assessment.finalScore;
  if (score >= 80) {
    return {
      route: "SENIOR_MEETING",
      automaticSchedulingEligible: false,
      reasonCode: "SCORE_80_100",
    };
  }
  if (score >= 60) {
    return {
      route: "STANDARD_MEETING",
      automaticSchedulingEligible: false,
      reasonCode: "SCORE_60_79",
    };
  }
  if (score >= 40) {
    return {
      route: "EXPLORATORY_MEETING",
      automaticSchedulingEligible: false,
      reasonCode: "SCORE_40_59",
    };
  }

  return {
    route: "NURTURE",
    automaticSchedulingEligible: false,
    reasonCode: "SCORE_0_39",
  };
}
