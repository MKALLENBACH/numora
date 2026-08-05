import { z } from "zod";

import { PublicAnswerValueSchema } from "./public";

export const INDUSTRIES = [
  "INDUSTRY",
  "CONSTRUCTION",
  "LOGISTICS",
  "DISTRIBUTION",
  "HEALTHCARE",
  "B2B_SERVICES",
  "TECHNOLOGY",
  "RETAIL",
  "FINANCIAL_SERVICES",
  "EDUCATION",
  "PUBLIC_SECTOR",
  "OTHER",
] as const;

export const IndustrySchema = z.enum(INDUSTRIES);
export type Industry = z.infer<typeof IndustrySchema>;

export const EMPLOYEE_RANGES = [
  "UP_TO_10",
  "11_50",
  "51_100",
  "101_500",
  "501_1000",
  "ABOVE_1000",
  "NOT_INFORMED",
] as const;

export const EmployeeRangeSchema = z.enum(EMPLOYEE_RANGES);
export type EmployeeRange = z.infer<typeof EmployeeRangeSchema>;

export const REVENUE_RANGES = [
  "UP_TO_5M",
  "5M_20M",
  "20M_100M",
  "100M_500M",
  "ABOVE_500M",
  "NOT_INFORMED",
] as const;

export const RevenueRangeSchema = z.enum(REVENUE_RANGES);
export type RevenueRange = z.infer<typeof RevenueRangeSchema>;

const TEMPORARY_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "dispostable.com",
  "fakeinbox.com",
  "guerrillamail.com",
  "mailinator.com",
  "maildrop.cc",
  "temp-mail.org",
  "tempmail.com",
  "throwawaymail.com",
  "yopmail.com",
]);

export function isTemporaryEmailAddress(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@").at(1);
  return domain ? TEMPORARY_EMAIL_DOMAINS.has(domain) : false;
}

export const IdentificationInputSchema = z
  .object({
    name: z.string().trim().min(2).max(150),
    role: z.string().trim().min(2).max(150),
    company: z.string().trim().min(2).max(200),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email()
      .max(254)
      .refine((email) => !isTemporaryEmailAddress(email), {
        message: "TEMPORARY_EMAIL",
      }),
    industry: IndustrySchema,
    industryOther: z.string().trim().min(2).max(150).optional(),
    employeeRange: EmployeeRangeSchema,
    phone: z
      .string()
      .trim()
      .max(30)
      .refine((phone) => {
        const digits = phone.replace(/\D/g, "");
        return digits.length >= 10 && digits.length <= 13;
      }, "INVALID_PHONE")
      .optional(),
    revenueRange: RevenueRangeSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.industry === "OTHER" && !value.industryOther) {
      context.addIssue({
        code: "custom",
        message: "INDUSTRY_OTHER_REQUIRED",
        path: ["industryOther"],
      });
    }
  });

export type IdentificationInput = z.infer<typeof IdentificationInputSchema>;

export const IDEMPOTENT_ACTIONS = [
  "START",
  "PRIVACY_CONSENT",
  "COMMERCIAL_CONSENT",
  "IDENTIFICATION",
  "SUBMIT_ANSWER",
  "UPDATE_REVIEW",
  "CONFIRM_REVIEW",
  "COMPLETE",
] as const;

export const IdempotentActionSchema = z.enum(IDEMPOTENT_ACTIONS);
export type IdempotentAction = z.infer<typeof IdempotentActionSchema>;

export const ClientRequestIdSchema = z.string().uuid();

export const IdempotencyKeySchema = z
  .string()
  .min(20)
  .max(400)
  .regex(/^[^:]+:[^:]+:[A-Z_]+:[0-9a-f-]{36}$/i);

export function buildIdempotencyKey(input: {
  authUserId: string;
  diagnosticId: string;
  action: IdempotentAction;
  clientRequestId: string;
}): string {
  const key = `${input.authUserId}:${input.diagnosticId}:${input.action}:${input.clientRequestId}`;
  return IdempotencyKeySchema.parse(key);
}

const IdempotentRequestFieldsSchema = z.object({
  clientRequestId: ClientRequestIdSchema,
  rowVersion: z.number().int().nonnegative(),
});

export const ConsentInputSchema = IdempotentRequestFieldsSchema.extend({
  accepted: z.boolean(),
  consentVersion: z.string().trim().min(1).max(50),
}).strict();

export type ConsentInput = z.infer<typeof ConsentInputSchema>;

export const SaveIdentificationInputSchema = IdempotentRequestFieldsSchema.extend({
  identification: IdentificationInputSchema,
}).strict();

export type SaveIdentificationInput = z.infer<
  typeof SaveIdentificationInputSchema
>;

export const SubmitAnswerInputSchema = IdempotentRequestFieldsSchema.extend({
  questionId: z.string().min(1).max(100),
  questionVersion: z.string().min(1).max(30),
  answer: PublicAnswerValueSchema,
  honeypot: z.string().max(0).optional(),
  elapsedMs: z.number().int().nonnegative().max(86_400_000),
}).strict();

export type SubmitAnswerInput = z.infer<typeof SubmitAnswerInputSchema>;

export const REVIEW_SECTIONS = [
  "company",
  "affectedArea",
  "challenge",
  "currentProcess",
  "participants",
  "systems",
  "mainImpacts",
  "desiredOutcome",
  "priority",
  "deadline",
  "decisionContext",
] as const;

export const ReviewSectionSchema = z.enum(REVIEW_SECTIONS);
export type ReviewSection = z.infer<typeof ReviewSectionSchema>;

export const UpdateReviewInputSchema = IdempotentRequestFieldsSchema.extend({
  section: ReviewSectionSchema,
  value: z.union([
    z.string().max(3_000),
    z.array(z.string().max(300)).max(20),
    z.null(),
  ]),
  reviewVersion: z.number().int().positive(),
}).strict();

export type UpdateReviewInput = z.infer<typeof UpdateReviewInputSchema>;
