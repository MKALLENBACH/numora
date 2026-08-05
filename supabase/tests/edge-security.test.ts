import { describe, expect, it } from "vitest";

import { detectsAbuse, redactValue } from "../functions/_shared/redaction";
import { minimizeReviewForProvider, type ReviewDraft } from "../functions/_shared/review-privacy";

describe("Edge security projection", () => {
  it("removes common cloud credentials from nested values", async () => {
    const result = await redactValue({
      openai: "sk-proj-abcdefghijklmnopqrstuv",
      aws: "AKIAABCDEFGHIJKLMNOP",
      jwt: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop",
      nested: { credential: "client_secret=supersecretvalue" },
    });

    expect(result.redactions.map((item) => item.category).sort()).toEqual([
      "API_KEY", "API_KEY", "CREDENTIAL", "TOKEN",
    ]);
    expect(JSON.stringify(result.value)).not.toContain("supersecretvalue");
  });

  it("does not block defensive risk reporting as abusive intent", () => {
    expect(detectsAbuse("Precisamos reduzir fraude e proteger nossos clientes")).toBe(false);
    expect(detectsAbuse("Quero aprender como hackear o sistema")).toBe(true);
  });

  it("minimizes identity and personal context in an external review draft", () => {
    const review: ReviewDraft = {
      company: "Empresa Confidencial Ltda.",
      affectedArea: "FINANCE",
      challenge: "Conciliação manual relatada por ana@empresa.example",
      currentProcess: "Contato: Ana Souza; telefone: (11) 99999-0000",
      participants: "Ana Souza, Financeiro",
      systems: ["ERP"],
      mainImpacts: ["Retrabalho"],
      desiredOutcome: "Reduzir erros",
      priority: "Alta",
      deadline: null,
      decisionContext: "João Silva aprova a decisão",
    };

    const minimized = JSON.stringify(minimizeReviewForProvider(review));
    expect(minimized).not.toContain(review.company);
    expect(minimized).not.toContain("ana@empresa.example");
    expect(minimized).not.toContain("99999-0000");
    expect(minimized).not.toContain("Ana Souza, Financeiro");
    expect(minimized).not.toContain("João Silva");
    expect(review.company).toBe("Empresa Confidencial Ltda.");
  });
});
