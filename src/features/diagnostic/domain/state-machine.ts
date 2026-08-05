import type { BlockingReason, DiagnosticStatus } from "./types";

export type DiagnosticMachineEvent =
  | { readonly type: "BEGIN" }
  | { readonly type: "PRIVACY_RECORDED"; readonly accepted: boolean }
  | { readonly type: "COMMERCIAL_CONSENT_RECORDED" }
  | { readonly type: "IDENTIFICATION_SAVED" }
  | { readonly type: "CHALLENGE_COMPLETED" }
  | { readonly type: "CURRENT_PROCESS_COMPLETED" }
  | { readonly type: "IMPACT_COMPLETED" }
  | { readonly type: "BUYING_CONTEXT_COMPLETED" }
  | { readonly type: "REVIEW_GENERATED" }
  | { readonly type: "REVIEW_EDIT_REQUESTED" }
  | { readonly type: "REVIEW_EDIT_SAVED" }
  | { readonly type: "REVIEW_CONFIRMED" }
  | { readonly type: "COMPLETION_PERSISTED" }
  | { readonly type: "BLOCK"; readonly reason: BlockingReason }
  | { readonly type: "EXPIRE" }
  | { readonly type: "ABANDON" };

export type DiagnosticMachineContext = {
  readonly storedCommercialConsent: boolean | null;
};

export class DiagnosticStateTransitionError extends Error {
  readonly code = "STATE_CONFLICT";

  constructor(
    readonly current: DiagnosticStatus,
    readonly event: DiagnosticMachineEvent["type"],
  ) {
    super(`Invalid diagnostic transition: ${current} + ${event}`);
    this.name = "DiagnosticStateTransitionError";
  }
}

const terminalStatuses = new Set<DiagnosticStatus>([
  "COMPLETED",
  "COMPLETED_NO_CONTACT",
  "BLOCKED",
  "EXPIRED",
  "ABANDONED",
]);

export function isTerminalDiagnosticStatus(status: DiagnosticStatus): boolean {
  return terminalStatuses.has(status);
}

export function transitionDiagnosticStatus(
  current: DiagnosticStatus,
  event: DiagnosticMachineEvent,
  context: DiagnosticMachineContext = { storedCommercialConsent: null },
): DiagnosticStatus {
  if (!isTerminalDiagnosticStatus(current)) {
    if (event.type === "BLOCK") return "BLOCKED";
    if (event.type === "EXPIRE") return "EXPIRED";
    if (event.type === "ABANDON") return "ABANDONED";
  }

  switch (current) {
    case "INTRODUCTION":
      if (event.type === "BEGIN") return "PRIVACY_CONSENT";
      break;
    case "PRIVACY_CONSENT":
      if (event.type === "PRIVACY_RECORDED") {
        return event.accepted ? "COMMERCIAL_CONSENT" : "BLOCKED";
      }
      break;
    case "COMMERCIAL_CONSENT":
      if (event.type === "COMMERCIAL_CONSENT_RECORDED") {
        return "IDENTIFICATION";
      }
      break;
    case "IDENTIFICATION":
      if (event.type === "IDENTIFICATION_SAVED") return "CHALLENGE";
      break;
    case "CHALLENGE":
      if (event.type === "CHALLENGE_COMPLETED") return "CURRENT_PROCESS";
      break;
    case "CURRENT_PROCESS":
      if (event.type === "CURRENT_PROCESS_COMPLETED") return "IMPACT";
      break;
    case "IMPACT":
      if (event.type === "IMPACT_COMPLETED") return "BUYING_CONTEXT";
      break;
    case "BUYING_CONTEXT":
      if (event.type === "BUYING_CONTEXT_COMPLETED") {
        return "REVIEW_GENERATING";
      }
      break;
    case "REVIEW_GENERATING":
      if (event.type === "REVIEW_GENERATED") return "REVIEW_PENDING";
      break;
    case "REVIEW_PENDING":
      if (event.type === "REVIEW_EDIT_REQUESTED") return "REVIEW_EDITING";
      if (event.type === "REVIEW_CONFIRMED") return "COMPLETING";
      break;
    case "REVIEW_EDITING":
      if (event.type === "REVIEW_EDIT_SAVED") return "REVIEW_GENERATING";
      break;
    case "COMPLETING":
      if (event.type === "COMPLETION_PERSISTED") {
        return context.storedCommercialConsent
          ? "COMPLETED"
          : "COMPLETED_NO_CONTACT";
      }
      break;
    case "COMPLETED":
    case "COMPLETED_NO_CONTACT":
    case "BLOCKED":
    case "EXPIRED":
    case "ABANDONED":
      break;
  }

  throw new DiagnosticStateTransitionError(current, event.type);
}

export function canTransitionDiagnosticStatus(
  current: DiagnosticStatus,
  event: DiagnosticMachineEvent,
  context?: DiagnosticMachineContext,
): boolean {
  try {
    transitionDiagnosticStatus(current, event, context);
    return true;
  } catch (error) {
    if (error instanceof DiagnosticStateTransitionError) return false;
    throw error;
  }
}
