import type { AnswerValue, PublicQuestion, PublicReview, ReviewSection } from "./types";

const reviewFields: ReadonlyArray<{ key: keyof PublicReview; title: string }> = [
  { key: "company", title: "Empresa" },
  { key: "affectedArea", title: "Área afetada" },
  { key: "challenge", title: "Desafio principal" },
  { key: "currentProcess", title: "Processo atual" },
  { key: "participants", title: "Pessoas e áreas envolvidas" },
  { key: "systems", title: "Sistemas" },
  { key: "mainImpacts", title: "Principais impactos" },
  { key: "desiredOutcome", title: "Resultado desejado" },
  { key: "priority", title: "Prioridade" },
  { key: "deadline", title: "Prazo" },
  { key: "decisionContext", title: "Contexto de decisão" },
];

const unitLabels: Readonly<Record<string, string>> = {
  MINUTES: "minutos",
  HOURS: "horas",
  DAYS: "dias",
  WEEKS: "semanas",
  HOURS_PER_WEEK: "horas por semana",
  HOURS_PER_MONTH: "horas por mês",
};

export function answerDisplayValue(question: PublicQuestion, value: AnswerValue) {
  if (Array.isArray(value)) {
    const labels = new Map((question.options ?? []).map((option) => [option.value, option.label]));
    return value.map((item) => labels.get(item) ?? item).join(", ");
  }
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (value && typeof value === "object") {
    if ("unknown" in value) return "Não sei informar";
    return `${value.value} ${unitLabels[value.unit] ?? value.unit}`.trim();
  }
  const option = question.options?.find((item) => item.value === value);
  return option?.label ?? String(value ?? "");
}

export function normalizeReviewSections(review: PublicReview): ReadonlyArray<ReviewSection> {
  return reviewFields.map(({ key, title }) => {
      const rawValue = review[key];
      return {
        key,
        title,
        value: Array.isArray(rawValue) ? rawValue.join(", ") : typeof rawValue === "string" ? rawValue : "",
      };
    });
}
