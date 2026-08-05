import { describe, expect, it } from "vitest";

import {
  getQuestionById,
  interviewCatalog,
  toPublicQuestion,
} from "../../src/features/diagnostic/domain/catalog";
import { DeterministicInterviewAIService as SourceAI } from "../../src/features/diagnostic/domain/ai-services";
import { getNextInterviewAction as sourceNextAction } from "../../src/features/diagnostic/domain/orchestrator";
import { calculateQualification as sourceQualification } from "../../src/features/diagnostic/domain/scoring";
import type { DiagnosticState } from "../../src/features/diagnostic/domain/types";
import {
  calculateQualification as generatedQualification,
  DEFAULT_INTERVIEW_RULES,
  DeterministicInterviewAIService as GeneratedAI,
  getNextInterviewAction as generatedNextAction,
} from "../functions/_shared/generated/domain-runtime.js";
import { GENERATED_INTERVIEW_CATALOG } from "../functions/_shared/generated/question-catalog";

const context = (): DiagnosticState => ({
  status: "CHALLENGE",
  privacyConsent: true,
  commercialConsent: true,
  privacyConsentVersion: "1.0.0",
  commercialConsentVersion: "1.0.0",
  identificationComplete: true,
  structuredData: {
    lead: { name: "Pessoa", role: "Diretoria", email: "pessoa@example.com", company: "Empresa" },
    challenge: {}, currentProcess: {}, impact: {}, buyingContext: {}, technicalContext: {},
  },
  answers: [], askedQuestionIds: [], clarifications: [], evidence: [], signals: [],
  review: null, reviewConfirmed: false, reviewCycles: 0,
  startedAtEpochMs: Date.parse("2026-08-05T12:00:00.000Z"),
  expiresAtEpochMs: Date.parse("2099-08-05T12:00:00.000Z"),
  currentTimeEpochMs: Date.parse("2026-08-05T12:01:00.000Z"),
});

describe("Supabase catalog projection", () => {
  it("is byte-for-byte equivalent to the canonical serializable catalog", () => {
    expect(GENERATED_INTERVIEW_CATALOG).toEqual(
      JSON.parse(JSON.stringify(interviewCatalog)),
    );
  });

  it("preserves version, conditions and every production question", () => {
    expect(GENERATED_INTERVIEW_CATALOG.version).toBe("1.0.0");
    expect(GENERATED_INTERVIEW_CATALOG.questions).toHaveLength(
      interviewCatalog.questions.length,
    );
    expect(
      GENERATED_INTERVIEW_CATALOG.questions.filter(
        (question) => "displayCondition" in question && question.displayCondition,
      ).length,
    ).toBe(
      interviewCatalog.questions.filter((question) => question.displayCondition)
        .length,
    );
  });

  it("keeps the generated Edge orchestrator equal to the canonical source", () => {
    const state = context();
    const source = sourceNextAction(state, interviewCatalog);
    const edge = generatedNextAction(
      state,
      GENERATED_INTERVIEW_CATALOG,
      DEFAULT_INTERVIEW_RULES,
    );

    expect(source).toEqual({ type: "ASK_QUESTION", questionId: "CHALLENGE_001" });
    expect(edge).toEqual(source);
  });

  it("keeps generated scoring and deterministic review equal to source", async () => {
    const state = context();
    const qualificationInput = {
      structuredData: state.structuredData,
      evidence: state.evidence,
    };
    expect(generatedQualification({
      structuredData: state.structuredData as unknown as Record<string, unknown>,
      evidence: [],
    })).toEqual(sourceQualification(
      qualificationInput as unknown as Parameters<typeof sourceQualification>[0],
    ));

    const structuredData = {
      "lead.company": "Empresa",
      "challenge.summary": "Conciliação manual com retrabalho",
      "challenge.primaryAffectedArea": "FINANCE",
    };
    await expect(new GeneratedAI().generateReview({ structuredData })).resolves.toEqual(
      await new SourceAI().generateReview({ structuredData }),
    );
  });

  it("keeps multi-target semantic extraction equal to the canonical source", async () => {
    const input = {
      question: toPublicQuestion(getQuestionById("CHALLENGE_001")!),
      answer:
        "Na área financeira e em operações, o processo de conciliação de notas gera atrasos e retrabalho recorrente.",
      targetPaths: [
        "challenge.summary",
        "challenge.affectedAreas",
        "challenge.primaryAffectedArea",
        "challenge.process",
        "challenge.symptoms",
      ],
      knownData: {},
    };
    const source = await new SourceAI().extractAnswer(input);
    const generated = await new GeneratedAI().extractAnswer(input);

    expect(generated).toEqual(source);
    expect(Object.fromEntries(
      generated.fields.map(({ path, value }) => [path, value]),
    )).toMatchObject({
      "challenge.affectedAreas": ["FINANCE", "OPERATIONS_LOGISTICS"],
      "challenge.primaryAffectedArea": "FINANCE",
      "challenge.process": "conciliação de notas",
      "challenge.symptoms": ["Retrabalho", "Atrasos"],
    });
  });
});
