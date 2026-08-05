import type { QuestionStage } from "../contracts";
import type {
  BlockingReason,
  DiagnosticState,
  InterviewCatalog,
  InterviewQuestion,
  InterviewRules,
  NextInterviewAction,
} from "./types";
import {
  createNextClarification,
  DEFAULT_INTERVIEW_RULES,
  getTotalQuestionCount,
  isQuestionEligible,
} from "./rules";

const stageOrder: readonly QuestionStage[] = [
  "CHALLENGE",
  "CURRENT_PROCESS",
  "IMPACT",
  "BUYING_CONTEXT",
];

const statusStage: Partial<Record<DiagnosticState["status"], QuestionStage>> = {
  CHALLENGE: "CHALLENGE",
  CURRENT_PROCESS: "CURRENT_PROCESS",
  IMPACT: "IMPACT",
  BUYING_CONTEXT: "BUYING_CONTEXT",
};

function blockingReason(state: DiagnosticState): BlockingReason | undefined {
  if (state.privacyConsent === false) return "PRIVACY_NOT_ACCEPTED";
  if (state.status === "EXPIRED" || state.currentTimeEpochMs >= state.expiresAtEpochMs) {
    return "SESSION_EXPIRED";
  }
  if (state.signals.includes("SEVERE_SENSITIVE_DATA_EXPOSURE")) {
    return "SEVERE_SENSITIVE_DATA_EXPOSURE";
  }
  if (state.signals.includes("PERSISTENT_PROMPT_INJECTION")) {
    return "PERSISTENT_PROMPT_INJECTION";
  }
  if (state.signals.includes("PERSISTENT_ABUSE")) return "PERSISTENT_ABUSE";
  if (state.signals.includes("ILLEGAL_REQUEST")) return "ILLEGAL_REQUEST";
  if (state.signals.includes("COMPLETELY_OUT_OF_SCOPE")) {
    return "COMPLETELY_OUT_OF_SCOPE";
  }
  if (state.status === "BLOCKED") return "SYSTEM_BLOCKED";
  return undefined;
}

function unansweredCriticalCount(
  catalog: InterviewCatalog,
  state: DiagnosticState,
): number {
  return catalog.questions.filter(
    (question) => question.critical && isQuestionEligible(question, state),
  ).length;
}

function selectQuestion(
  state: DiagnosticState,
  catalog: InterviewCatalog,
  rules: InterviewRules,
): InterviewQuestion | undefined {
  const count = getTotalQuestionCount(state);
  const currentStage = statusStage[state.status];
  const startIndex = currentStage ? stageOrder.indexOf(currentStage) : 0;
  const eligible = catalog.questions.filter((question) =>
    isQuestionEligible(question, state),
  );

  const areaQuestionsAsked = state.askedQuestionIds.filter((id) =>
    catalog.questions.some(
      (question) => question.id === id && question.kind === "AREA_SPECIFIC",
    ),
  ).length;

  const onlyCritical = count >= rules.targetQuestionsMax;
  const missingCritical = unansweredCriticalCount(catalog, state);
  const nonCriticalBudget = Math.max(
    0,
    rules.targetQuestionsMax - count - missingCritical,
  );

  for (let stageIndex = Math.max(0, startIndex); stageIndex < stageOrder.length; stageIndex += 1) {
    const stage = stageOrder[stageIndex];
    const candidates = eligible
      .filter((question) => question.stage === stage)
      .filter((question) => {
        // Re-showing an interrupted question consumes no new budget: it is
        // already part of askedQuestionIds and still has no persisted answer.
        if (state.askedQuestionIds.includes(question.id)) return true;
        if (question.critical) return true;
        if (onlyCritical || count >= rules.exceptionalQuestionsMax) return false;
        if (question.kind === "AREA_SPECIFIC") {
          return (
            nonCriticalBudget > 0 &&
            areaQuestionsAsked < rules.maxAreaSpecificQuestions
          );
        }
        if (question.required) return nonCriticalBudget > 0;
        if (question.displayCondition) return nonCriticalBudget > 0;
        return count < rules.targetQuestionsMin && nonCriticalBudget > 0;
      })
      .sort((left, right) => {
        const tier = (question: InterviewQuestion): number => {
          if (state.askedQuestionIds.includes(question.id)) return -1;
          if (question.critical) return 0;
          if (question.required) return 1;
          if (question.displayCondition && question.kind === "CORE") return 2;
          if (question.kind === "AREA_SPECIFIC") return 3;
          return 4;
        };
        return tier(left) - tier(right) || left.priority - right.priority;
      });

    if (candidates[0]) return candidates[0];
  }

  return undefined;
}

/**
 * Pure orchestration policy. It reads only the supplied state/catalog/rules;
 * persistence, clocks and AI calls remain outside this function.
 */
export function getNextInterviewAction(
  state: DiagnosticState,
  catalog: InterviewCatalog,
  rules: InterviewRules = DEFAULT_INTERVIEW_RULES,
): NextInterviewAction {
  const reason = blockingReason(state);
  if (reason) return { type: "BLOCK", reason };

  if (state.status === "REVIEW_GENERATING") return { type: "GENERATE_REVIEW" };
  if (state.status === "REVIEW_PENDING" || state.status === "REVIEW_EDITING") {
    return { type: "SHOW_REVIEW" };
  }
  if (
    state.status === "COMPLETING" ||
    state.status === "COMPLETED" ||
    state.status === "COMPLETED_NO_CONTACT"
  ) {
    return { type: "COMPLETE" };
  }

  if (!statusStage[state.status]) {
    return { type: "BLOCK", reason: "SYSTEM_BLOCKED" };
  }

  const count = getTotalQuestionCount(state);
  if (count >= rules.absoluteQuestionsMax) return { type: "GENERATE_REVIEW" };

  const clarification = createNextClarification(state, catalog, rules);
  if (clarification) return { type: "ASK_CLARIFICATION", clarification };

  const nextQuestion = selectQuestion(state, catalog, rules);
  if (nextQuestion) return { type: "ASK_QUESTION", questionId: nextQuestion.id };

  return { type: "GENERATE_REVIEW" };
}
