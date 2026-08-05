import { describe, expect, it } from "vitest";

import { publicErrorMessages, publicStages } from "../src/features/diagnostic/client/content";
import { answerDisplayValue, normalizeReviewSections } from "../src/features/diagnostic/client/presentation";
import type { PublicQuestion, PublicReview } from "../src/features/diagnostic/client/types";

const choiceQuestion: PublicQuestion = {
  id: "PROCESS_001",
  version: "1.0.0",
  stage: "CURRENT_PROCESS",
  text: "Como o processo acontece?",
  responseType: "MULTIPLE_CHOICE",
  required: true,
  options: [
    { value: "MANUAL", label: "Atividades manuais" },
    { value: "SYSTEMS", label: "Múltiplos sistemas" },
  ],
};

describe("apresentação pública do diagnóstico", () => {
  it("expõe somente as seis etapas públicas de progresso", () => {
    expect(publicStages.map((stage) => stage.label)).toEqual([
      "Identificação",
      "Desafio",
      "Processo",
      "Impacto",
      "Contexto",
      "Revisão",
    ]);
  });

  it("converte opções técnicas em rótulos compreensíveis", () => {
    expect(answerDisplayValue(choiceQuestion, ["MANUAL", "SYSTEMS"])).toBe(
      "Atividades manuais, Múltiplos sistemas",
    );
    expect(answerDisplayValue({ ...choiceQuestion, responseType: "YES_NO" }, true)).toBe("Sim");
    expect(
      answerDisplayValue(
        {
          ...choiceQuestion,
          responseType: "NUMBER_WITH_UNIT",
          options: undefined,
          validation: { units: ["HOURS_PER_WEEK"] },
        },
        { value: 12, unit: "HOURS_PER_WEEK" },
      ),
    ).toBe("12 horas por semana");
  });

  it("normaliza listas do resumo sem expor campos internos", () => {
    const review: PublicReview = {
      version: 1,
      company: "Empresa Exemplo",
      affectedArea: "Operações",
      challenge: "Retrabalho entre áreas",
      currentProcess: "Planilhas e e-mail",
      participants: "Operações e financeiro",
      systems: ["ERP", "Planilha"],
      mainImpacts: ["Atraso", "Erros"],
      desiredOutcome: "Reduzir retrabalho",
      priority: "Alta",
      deadline: null,
      decisionContext: "Avaliação inicial",
      confirmed: false,
    };

    const sections = normalizeReviewSections(review);
    expect(sections).toHaveLength(11);
    expect(sections.find((section) => section.key === "systems")?.value).toBe("ERP, Planilha");
    expect(sections.find((section) => section.key === "deadline")?.value).toBe("");
    expect(sections.map((section) => section.key)).not.toContain("score");
    expect(sections.map((section) => section.key)).not.toContain("flags");
    expect(sections.map((section) => section.key)).not.toContain("briefing");
  });

  it("mantém mensagens públicas sem detalhes técnicos sensíveis", () => {
    const messages = Object.values(publicErrorMessages).join(" ").toLowerCase();
    expect(messages).not.toContain("service role");
    expect(messages).not.toContain("sql");
    expect(messages).not.toContain("stack");
  });
});
