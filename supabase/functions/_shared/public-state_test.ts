import { assertEquals } from "jsr:@std/assert@1.0.14";
import { GENERATED_INTERVIEW_CATALOG } from "./generated/question-catalog.ts";
import { getCatalogQuestion, toPublicQuestion } from "./interview.ts";

Deno.test("generated server catalog contains the complete canonical projection", () => {
  assertEquals(GENERATED_INTERVIEW_CATALOG.version, "1.0.0");
  assertEquals(GENERATED_INTERVIEW_CATALOG.questions.length >= 40, true);
});

Deno.test("public projection strips internal policy fields", () => {
  const question = toPublicQuestion(getCatalogQuestion("CHALLENGE_001")!);
  assertEquals(question.version, "1.0.0");
  assertEquals("purpose" in question, false);
  assertEquals("critical" in question, false);
});
