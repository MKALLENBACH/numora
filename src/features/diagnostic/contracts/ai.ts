import { z } from "zod";

import { PublicAnswerValueSchema, PublicQuestionSchema } from "./public";

export const ExtractedFieldSchema = z
  .object({
    path: z.string().min(1),
    value: z.unknown(),
    sourceType: z.enum([
      "REPORTED_FACT",
      "CLIENT_ESTIMATE",
      "AI_INFERENCE",
      "NOT_CONFIRMED",
    ]),
    confidence: z.number().min(0).max(1),
    evidenceText: z.string().max(500),
  })
  .strict();

export type ExtractedField = z.infer<typeof ExtractedFieldSchema>;

export const ExtractAnswerResultSchema = z
  .object({
    fields: z.array(ExtractedFieldSchema).max(30),
    detectedSensitiveData: z.boolean(),
    sensitiveDataCategories: z.array(z.string().max(100)).max(10),
    responseClarity: z.enum(["CLEAR", "PARTIAL", "VAGUE"]),
    summary: z.string().max(500),
  })
  .strict();

export type ExtractAnswerResult = z.infer<typeof ExtractAnswerResultSchema>;

export const ClarityResultSchema = z
  .object({
    level: z.enum(["CLEAR", "PARTIAL", "VAGUE"]),
    confidence: z.number().min(0).max(1),
    missingAspects: z.array(z.string().max(200)).max(5),
    shouldClarify: z.boolean(),
  })
  .strict();

export type ClarityResult = z.infer<typeof ClarityResultSchema>;

export const ClarificationSuggestionSchema = z
  .object({
    question: z.string().min(10).max(300),
    reason: z.string().max(300),
    relatedQuestionId: z.string().min(1).max(100),
  })
  .strict();

export type ClarificationSuggestion = z.infer<
  typeof ClarificationSuggestionSchema
>;

export const GeneratedReviewSchema = z
  .object({
    company: z.string().max(200),
    affectedArea: z.string().max(100),
    challenge: z.string().max(800),
    currentProcess: z.string().max(1_200),
    participants: z.string().max(500),
    systems: z.array(z.string().max(100)).max(20),
    mainImpacts: z.array(z.string().max(200)).max(15),
    desiredOutcome: z.string().max(800),
    priority: z.string().max(100),
    deadline: z.string().max(300).nullable(),
    decisionContext: z.string().max(800),
  })
  .strict();

export type GeneratedReview = z.infer<typeof GeneratedReviewSchema>;

export const GeneratedBriefingSchema = z
  .object({
    executiveSummary: z.string().max(2_000),
    challengeSummary: z.string().max(1_500),
    currentProcessSummary: z.string().max(2_000),
    impactSummary: z.string().max(1_500),
    buyingContextSummary: z.string().max(1_500),
    technicalContextSummary: z.string().max(1_500),
    initialHypotheses: z
      .array(
        z
          .object({
            text: z.string().max(800),
            sourceType: z.literal("AI_INFERENCE"),
            confirmed: z.literal(false),
          })
          .strict(),
      )
      .max(10),
    missingInformation: z.array(z.string().max(300)).max(15),
    recommendedQuestions: z.array(z.string().max(500)).max(15),
    recommendedParticipants: z.array(z.string().max(200)).max(10),
  })
  .strict();

export type GeneratedBriefing = z.infer<typeof GeneratedBriefingSchema>;

const FlatStructuredDataSchema = z.record(z.string(), z.unknown());

export const ExtractAnswerInputSchema = z
  .object({
    question: PublicQuestionSchema,
    answer: PublicAnswerValueSchema,
    targetPaths: z.array(z.string().min(1).max(200)).max(20),
    knownData: FlatStructuredDataSchema.default({}),
  })
  .strict();

export type ExtractAnswerInput = z.infer<typeof ExtractAnswerInputSchema>;

export const EvaluateClarityInputSchema = z
  .object({
    question: PublicQuestionSchema,
    answer: PublicAnswerValueSchema,
  })
  .strict();

export type EvaluateClarityInput = z.infer<typeof EvaluateClarityInputSchema>;

export const SuggestClarificationInputSchema = z
  .object({
    question: PublicQuestionSchema,
    answer: PublicAnswerValueSchema,
    clarity: ClarityResultSchema,
    priorClarifications: z.array(z.string().max(300)).max(4),
  })
  .strict();

export type SuggestClarificationInput = z.infer<
  typeof SuggestClarificationInputSchema
>;

export const GenerateReviewInputSchema = z
  .object({
    structuredData: FlatStructuredDataSchema,
  })
  .strict();

export type GenerateReviewInput = z.infer<typeof GenerateReviewInputSchema>;

export const GenerateBriefingInputSchema = z
  .object({
    structuredData: FlatStructuredDataSchema,
    review: GeneratedReviewSchema,
    missingCriticalPaths: z.array(z.string().min(1).max(200)).max(30),
  })
  .strict();

export type GenerateBriefingInput = z.infer<typeof GenerateBriefingInputSchema>;

export interface InterviewAIService {
  extractAnswer(input: ExtractAnswerInput): Promise<ExtractAnswerResult>;
  evaluateClarity(input: EvaluateClarityInput): Promise<ClarityResult>;
  suggestClarification(
    input: SuggestClarificationInput,
  ): Promise<ClarificationSuggestion>;
  generateReview(input: GenerateReviewInput): Promise<GeneratedReview>;
  generateBriefing(input: GenerateBriefingInput): Promise<GeneratedBriefing>;
}

export type InterviewAIOperation = keyof InterviewAIService;
