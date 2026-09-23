import { z } from "zod";

export const ADMIN_DIAGNOSTIC_STATUSES = [
  "INTRODUCTION",
  "PRIVACY_CONSENT",
  "COMMERCIAL_CONSENT",
  "IDENTIFICATION",
  "CHALLENGE",
  "CURRENT_PROCESS",
  "IMPACT",
  "BUYING_CONTEXT",
  "REVIEW_GENERATING",
  "REVIEW_PENDING",
  "REVIEW_EDITING",
  "COMPLETING",
  "COMPLETED",
  "COMPLETED_NO_CONTACT",
  "BLOCKED",
  "EXPIRED",
  "ABANDONED",
] as const;

export const ADMIN_DIAGNOSTIC_INDUSTRIES = [
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

export const ADMIN_DIAGNOSTIC_EMPLOYEE_RANGES = [
  "UP_TO_10",
  "11_50",
  "51_100",
  "101_500",
  "501_1000",
  "ABOVE_1000",
  "NOT_INFORMED",
] as const;

export const ADMIN_DIAGNOSTIC_AREAS = [
  "COMMERCIAL",
  "FINANCE",
  "CUSTOMER_SERVICE",
  "OPERATIONS_LOGISTICS",
  "PROCUREMENT",
  "HUMAN_RESOURCES",
  "LEGAL",
  "TECHNOLOGY",
  "OTHER",
] as const;

export const ADMIN_DIAGNOSTIC_CLASSIFICATIONS = [
  "PRIORITY",
  "QUALIFIED",
  "INVESTIGATION",
  "LOW_FIT",
  "INSUFFICIENT",
] as const;

export const ADMIN_DIAGNOSTIC_FLAG_SEVERITIES = ["S0", "S1", "S2", "S3"] as const;
export const ADMIN_DIAGNOSTIC_PRIORITIES = [1, 2, 3, 4, 5] as const;
export const ADMIN_DIAGNOSTIC_SORT_FIELDS = [
  "createdAt",
  "finalScore",
  "declaredPriority",
  "highestFlagSeverity",
  "companyName",
] as const;

const DateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}, "INVALID_DATE");

const FiltersSchema = z.object({
  diagnosticStatus: z.array(z.enum(ADMIN_DIAGNOSTIC_STATUSES)).max(17).optional(),
  classification: z.array(z.enum(ADMIN_DIAGNOSTIC_CLASSIFICATIONS)).max(5).optional(),
  scoreState: z.enum(["PRESENT", "ABSENT"]).optional(),
  scoreMin: z.number().int().min(0).max(100).optional(),
  scoreMax: z.number().int().min(0).max(100).optional(),
  industry: z.array(z.enum(ADMIN_DIAGNOSTIC_INDUSTRIES)).max(12).optional(),
  employeeRange: z.array(z.enum(ADMIN_DIAGNOSTIC_EMPLOYEE_RANGES)).max(7).optional(),
  primaryArea: z.array(z.enum(ADMIN_DIAGNOSTIC_AREAS)).max(9).optional(),
  declaredPriority: z.array(z.union([
    z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
  ])).max(5).optional(),
  flagSeverity: z.array(z.enum(ADMIN_DIAGNOSTIC_FLAG_SEVERITIES)).max(4).optional(),
  contactAllowed: z.boolean().optional(),
  dateFrom: DateOnlySchema.optional(),
  dateTo: DateOnlySchema.optional(),
}).strict().superRefine((filters, context) => {
  if (
    filters.scoreMin !== undefined &&
    filters.scoreMax !== undefined &&
    filters.scoreMin > filters.scoreMax
  ) {
    context.addIssue({ code: "custom", message: "INVALID_SCORE_RANGE", path: ["scoreMax"] });
  }
  if (
    filters.scoreState === "ABSENT" &&
    (filters.scoreMin !== undefined || filters.scoreMax !== undefined)
  ) {
    context.addIssue({ code: "custom", message: "SCORE_RANGE_WITHOUT_SCORE", path: ["scoreState"] });
  }
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    context.addIssue({ code: "custom", message: "INVALID_DATE_RANGE", path: ["dateTo"] });
  }
});

export const AdminDiagnosticListRequestSchema = z.object({
  page: z.number().int().min(1).max(100_000).default(1),
  pageSize: z.literal(25).default(25),
  search: z.string().trim().min(2).max(320).optional(),
  filters: FiltersSchema.default({}),
  sort: z.object({
    field: z.enum(ADMIN_DIAGNOSTIC_SORT_FIELDS),
    direction: z.enum(["asc", "desc"]),
  }).strict().default({ field: "createdAt", direction: "desc" }),
}).strict();

export const AdminDiagnosticListItemSchema = z.object({
  diagnosticId: z.uuid(),
  companyName: z.string().max(200).nullable(),
  contactName: z.string().max(150).nullable(),
  contactRole: z.string().max(150).nullable(),
  industry: z.enum(ADMIN_DIAGNOSTIC_INDUSTRIES).nullable(),
  employeeRange: z.enum(ADMIN_DIAGNOSTIC_EMPLOYEE_RANGES).nullable(),
  primaryArea: z.enum(ADMIN_DIAGNOSTIC_AREAS).nullable(),
  declaredPriority: z.union([
    z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
  ]).nullable(),
  finalScore: z.number().int().min(0).max(100).nullable(),
  classification: z.enum(ADMIN_DIAGNOSTIC_CLASSIFICATIONS).nullable(),
  highestFlagSeverity: z.enum(ADMIN_DIAGNOSTIC_FLAG_SEVERITIES).nullable(),
  diagnosticStatus: z.enum(ADMIN_DIAGNOSTIC_STATUSES),
  reviewStatus: z.null(),
  contactAllowed: z.boolean(),
  assignee: z.object({
    profileId: z.uuid(),
    displayName: z.string().min(2).max(150),
  }).strict().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
}).strict();

export const AdminDiagnosticListDataSchema = z.object({
  items: z.array(AdminDiagnosticListItemSchema).max(25),
  pagination: z.object({
    page: z.number().int().min(1),
    pageSize: z.literal(25),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }).strict(),
}).strict();

export type AdminDiagnosticListRequest = z.infer<typeof AdminDiagnosticListRequestSchema>;
export type AdminDiagnosticListItem = z.infer<typeof AdminDiagnosticListItemSchema>;
export type AdminDiagnosticListData = z.infer<typeof AdminDiagnosticListDataSchema>;
