import type { PublicAnswerValue } from "../contracts";
import { getQuestionById } from "./catalog";
import type {
  ClarificationQuestion,
  ClarificationType,
  DiagnosticState,
  InterviewCatalog,
  InterviewQuestion,
  InterviewRules,
  QuestionCondition,
} from "./types";
import {
  answerAsArray,
  answerAsText,
  getValueAtPath,
  isPresent,
  normalizeText,
} from "./value-utils";

export const DEFAULT_INTERVIEW_RULES: InterviewRules = Object.freeze({
  targetQuestionsMin: 12,
  targetQuestionsMax: 18,
  exceptionalQuestionsMax: 20,
  absoluteQuestionsMax: 24,
  maxClarificationsTotal: 4,
  maxAreaSpecificQuestions: 2,
});

export const CLARIFICATION_LIMIT_MESSAGE =
  "Sem problemas. Vamos registrar essa informação como ainda não definida e continuar.";

const CLARIFICATION_TEMPLATES: Readonly<
  Record<ClarificationType, (state: DiagnosticState) => string>
> = {
  VAGUE_PROBLEM: () =>
    "Para compreendermos melhor, poderia dar um exemplo concreto de quando esse problema acontece?",
  AREA_WITHOUT_PROCESS: (state) => {
    const area = state.structuredData.challenge.primaryAffectedArea ?? "essa área";
    return `Dentro de ${area}, qual atividade mais consome tempo, gera erros ou dificulta o crescimento?`;
  },
  GENERIC_AI_REQUEST: () =>
    "Antes de pensar em tecnologia, qual problema operacional essa iniciativa deveria resolver?",
  GENERIC_AUTOMATION_REQUEST: () =>
    "Qual processo você gostaria de automatizar e o que atualmente torna esse processo ineficiente?",
  INCOMPLETE_PROCESS: () =>
    "O que acontece primeiro, quem recebe a demanda e como o processo é finalizado?",
  IMPACT_MISSING: () =>
    "Por que essa iniciativa é importante para a empresa neste momento?",
  CONTRADICTION: () =>
    "Identifiquei informações que parecem diferentes entre si. Qual delas representa melhor a situação atual?",
};

export function getLatestAnswer(
  state: DiagnosticState,
  questionId: string,
): DiagnosticState["answers"][number] | undefined {
  return state.answers.reduce<DiagnosticState["answers"][number] | undefined>(
    (latest, answer) => {
      if (answer.questionId !== questionId) return latest;
      if (!latest || answer.revision > latest.revision) return answer;
      if (
        answer.revision === latest.revision &&
        answer.answeredAtEpochMs >= latest.answeredAtEpochMs
      ) {
        return answer;
      }
      return latest;
    },
    undefined,
  );
}

function equalsAnswer(
  answer: PublicAnswerValue | undefined,
  expected: string | number | boolean,
): boolean {
  if (answer === undefined || Array.isArray(answer) || typeof answer === "object") {
    return false;
  }
  return answer === expected;
}

export function getTotalQuestionCount(state: DiagnosticState): number {
  return new Set(state.askedQuestionIds).size + state.clarifications.length;
}

export function evaluateQuestionCondition(
  condition: QuestionCondition,
  state: DiagnosticState,
): boolean {
  switch (condition.type) {
    case "ALL":
      return condition.conditions.every((child) =>
        evaluateQuestionCondition(child, state),
      );
    case "ANY":
      return condition.conditions.some((child) =>
        evaluateQuestionCondition(child, state),
      );
    case "NOT":
      return !evaluateQuestionCondition(condition.condition, state);
    case "ANSWER_EQUALS":
      return equalsAnswer(
        getLatestAnswer(state, condition.questionId)?.value,
        condition.value,
      );
    case "ANSWER_INCLUDES":
      return answerAsArray(
        getLatestAnswer(state, condition.questionId)?.value ?? [],
      ).includes(condition.value);
    case "ANSWER_ARRAY_MIN_LENGTH":
      return (
        answerAsArray(
          getLatestAnswer(state, condition.questionId)?.value ?? [],
        ).length >= condition.minimum
      );
    case "FIELD_PRESENT":
      return isPresent(getValueAtPath(state.structuredData, condition.path));
    case "FIELD_MISSING":
      return !isPresent(getValueAtPath(state.structuredData, condition.path));
    case "FIELD_IN":
      return condition.values.includes(
        getValueAtPath(state.structuredData, condition.path) as never,
      );
    case "SIGNAL_PRESENT":
      return state.signals.includes(condition.signal);
    case "QUESTION_COUNT_BELOW":
      return getTotalQuestionCount(state) < condition.limit;
    case "AREA_EQUALS":
      return state.structuredData.challenge.primaryAffectedArea === condition.area;
  }
}

export function isQuestionAnswered(
  questionId: string,
  state: DiagnosticState,
): boolean {
  return getLatestAnswer(state, questionId) !== undefined;
}

export function isQuestionEligible(
  question: InterviewQuestion,
  state: DiagnosticState,
): boolean {
  // An interrupted request can persist the fact that a question was shown
  // before its answer exists. It must remain eligible so resume never skips it.
  if (isQuestionAnswered(question.id, state)) {
    return false;
  }

  return question.displayCondition
    ? evaluateQuestionCondition(question.displayCondition, state)
    : true;
}

function inferClarificationType(
  answer: DiagnosticState["answers"][number],
  question: InterviewQuestion,
  state: DiagnosticState,
): ClarificationType | undefined {
  if (answer.clarificationType) return answer.clarificationType;
  if (state.signals.includes("CONTRADICTION")) return "CONTRADICTION";

  const normalized = normalizeText(answerAsText(answer.value));

  if (/\b(ia|inteligencia artificial|chatgpt|agente)\b/.test(normalized)) {
    return "GENERIC_AI_REQUEST";
  }
  if (/\b(automatizar|automacao|robo|rpa)\b/.test(normalized)) {
    return "GENERIC_AUTOMATION_REQUEST";
  }

  return question.defaultClarificationType;
}

export function getPendingClarification(
  state: DiagnosticState,
): ClarificationQuestion | undefined {
  const pending = state.clarifications.find((item) => {
    if (item.answered) return false;
    const currentAnswer = getLatestAnswer(state, item.relatedQuestionId);
    return currentAnswer !== undefined &&
      (currentAnswer.needsClarification === true ||
        currentAnswer.clarity !== "CLEAR");
  });
  if (!pending) return undefined;

  return {
    id: pending.id,
    type: pending.type,
    relatedQuestionId: pending.relatedQuestionId,
    text: pending.text,
    sequence: pending.sequence,
  };
}

export function createNextClarification(
  state: DiagnosticState,
  catalog: InterviewCatalog,
  rules: InterviewRules = DEFAULT_INTERVIEW_RULES,
): ClarificationQuestion | undefined {
  const pending = getPendingClarification(state);
  if (pending) return pending;

  if (state.clarifications.length >= rules.maxClarificationsTotal) {
    return undefined;
  }

  const latestByQuestion = new Map<
    string,
    DiagnosticState["answers"][number]
  >();
  for (const answer of state.answers) {
    const latest = latestByQuestion.get(answer.questionId);
    if (
      !latest ||
      answer.revision > latest.revision ||
      (answer.revision === latest.revision &&
        answer.answeredAtEpochMs >= latest.answeredAtEpochMs)
    ) {
      latestByQuestion.set(answer.questionId, answer);
    }
  }

  const currentAnswers = [...latestByQuestion.values()].sort(
    (left, right) =>
      right.answeredAtEpochMs - left.answeredAtEpochMs ||
      right.revision - left.revision,
  );
  const totalQuestionCount = getTotalQuestionCount(state);

  for (const answer of currentAnswers) {
    if (!answer.needsClarification && answer.clarity === "CLEAR") {
      continue;
    }

    const question = getQuestionById(answer.questionId, catalog);
    if (!question) continue;

    // From the target ceiling onward only a missing critical answer can open a
    // new clarification. Existing pending clarification remains resumable.
    if (totalQuestionCount >= rules.targetQuestionsMax && !question.critical) {
      continue;
    }

    const priorForQuestion = state.clarifications.filter(
      (item) => item.relatedQuestionId === question.id,
    );
    if (priorForQuestion.length >= question.maxClarifications) continue;

    const type = inferClarificationType(answer, question, state);
    if (!type || priorForQuestion.some((item) => item.type === type)) continue;

    const sequence = priorForQuestion.length + 1;
    return {
      id: `${question.id}:${type}:${sequence}`,
      type,
      relatedQuestionId: question.id,
      text: question.id === "CHALLENGE_002"
        ? "Além da tecnologia, qual resultado a empresa espera alcançar na operação?"
        : CLARIFICATION_TEMPLATES[type](state),
      sequence,
    };
  }

  return undefined;
}

export function listMissingCriticalPaths(
  state: DiagnosticState,
  catalog: InterviewCatalog,
): readonly string[] {
  return catalog.criticalPaths.filter(
    (path) => !isPresent(getValueAtPath(state.structuredData, path)),
  );
}
