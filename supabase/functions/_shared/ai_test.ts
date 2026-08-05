import { assertEquals } from "jsr:@std/assert@1.0.14";
import { minimizeReviewForProvider, type GeneratedReview } from "./ai.ts";

const review: GeneratedReview = {
  company: "Empresa Confidencial Ltda.",
  affectedArea: "FINANCE",
  challenge: "Conciliação manual",
  currentProcess: "Planilhas",
  participants: "Financeiro",
  systems: ["ERP"],
  mainImpacts: ["Retrabalho"],
  desiredOutcome: "Reduzir erros",
  priority: "Alta",
  deadline: null,
  decisionContext: "Diretoria",
};

Deno.test("external review payload omits the real company name", () => {
  const minimized = minimizeReviewForProvider(review);
  assertEquals(JSON.stringify(minimized).includes(review.company), false);
  assertEquals(review.company, "Empresa Confidencial Ltda.");
});
