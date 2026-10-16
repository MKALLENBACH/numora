import { z } from "zod";

export const REVIEW_STATUSES = ["NEW","UNDER_REVIEW","NEEDS_INFORMATION","QUALIFIED","NOT_QUALIFIED","OUT_OF_SCOPE","NO_CONTACT_PERMISSION","BLOCKED","ARCHIVED"] as const;
export const ADMIN_PRIORITIES = ["LOW","NORMAL","HIGH","URGENT"] as const;
export const NOTE_CATEGORIES = ["GENERAL","COMMERCIAL","TECHNICAL","RISK","FOLLOW_UP","DECISION"] as const;
export const WORKFLOW_COMMANDS = ["CLAIM","ASSIGN","UNASSIGN","SET_STATUS","SET_PRIORITY","ADD_NOTE","CREATE_OVERRIDE","REVERT_OVERRIDE","REVIEW_HYPOTHESIS","RESOLVE_FLAG","REOPEN_FLAG","RECALCULATE_QUALIFICATION","REGENERATE_BRIEFING","ARCHIVE","REOPEN"] as const;
const text = z.string().trim().min(1).max(2000);
const texts = z.array(z.string().trim().min(1).max(200)).max(30);
export const OVERRIDE_VALUES = {
 "lead.company": z.string().trim().min(2).max(200),
 "lead.role": z.string().trim().min(2).max(150),
 "lead.industry": z.enum(["INDUSTRY","CONSTRUCTION","LOGISTICS","DISTRIBUTION","HEALTHCARE","B2B_SERVICES","TECHNOLOGY","RETAIL","FINANCIAL_SERVICES","EDUCATION","PUBLIC_SECTOR","OTHER"]),
 "lead.employeeRange": z.enum(["UP_TO_10","11_50","51_100","101_500","501_1000","ABOVE_1000","NOT_INFORMED"]),
 "challenge.summary": text, "challenge.process": text, "challenge.desiredOutcome": text,
 "challenge.primaryAffectedArea": z.enum(["COMMERCIAL","FINANCE","CUSTOMER_SERVICE","OPERATIONS_LOGISTICS","PROCUREMENT","HUMAN_RESOURCES","LEGAL","TECHNOLOGY","OTHER"]),
 "challenge.symptoms": texts,
 "currentProcess.description": text, "currentProcess.participants": text,
 "currentProcess.systems": texts, "currentProcess.involvedAreas": texts,
 "currentProcess.participantCount": z.number().int().min(0).max(100000),
 "currentProcess.manualDependency": text, "currentProcess.duplicateDataEntry": z.boolean(),
 "impact.categories": texts, "impact.reportedFinancialImpact": text, "impact.riskOfInaction": text,
 "buyingContext.priority": z.number().int().min(1).max(5),
 "buyingContext.deadline": text, "buyingContext.decisionMakers": texts,
 "buyingContext.processRedesignOpenness": text,
 "technicalContext.dataAvailability": text, "technicalContext.itAvailability": text, "technicalContext.integrationLikely": z.boolean(),
} as const;
export const OVERRIDE_PATHS = Object.keys(OVERRIDE_VALUES) as [keyof typeof OVERRIDE_VALUES, ...(keyof typeof OVERRIDE_VALUES)[]];
export const ReasonSchema = z.string().trim().min(10).max(1000);
const support = { evidenceIds: z.array(z.uuid()).max(20).default([]), evidenceNote: z.string().trim().max(500).default("") };
const envelope = { diagnosticId:z.uuid(), clientRequestId:z.uuid(), expectedReviewVersion:z.number().int().positive(), expectedDiagnosticVersion:z.number().int().positive() };
const simple = (command: "CLAIM"|"RECALCULATE_QUALIFICATION"|"REGENERATE_BRIEFING") => z.object({...envelope,command:z.literal(command),payload:z.object({}).strict()}).strict();
export const AdminWorkflowCommandSchema = z.discriminatedUnion("command",[
 simple("CLAIM"),simple("RECALCULATE_QUALIFICATION"),simple("REGENERATE_BRIEFING"),
 z.object({...envelope,command:z.literal("ASSIGN"),payload:z.object({profileId:z.uuid(),reason:ReasonSchema.optional()}).strict()}).strict(),
 ...(["UNASSIGN","ARCHIVE","REOPEN"] as const).map(command=>z.object({...envelope,command:z.literal(command),payload:z.object({reason:ReasonSchema}).strict()}).strict()),
 z.object({...envelope,command:z.literal("SET_STATUS"),payload:z.object({status:z.enum(REVIEW_STATUSES),reason:ReasonSchema.optional()}).strict()}).strict(),
 z.object({...envelope,command:z.literal("SET_PRIORITY"),payload:z.object({priority:z.enum(ADMIN_PRIORITIES),reason:ReasonSchema.optional()}).strict()}).strict(),
 z.object({...envelope,command:z.literal("ADD_NOTE"),payload:z.object({category:z.enum(NOTE_CATEGORIES),body:z.string().trim().min(1).max(4000)}).strict()}).strict(),
 z.object({...envelope,command:z.literal("CREATE_OVERRIDE"),payload:z.object({fieldPath:z.enum(OVERRIDE_PATHS),value:z.json(),verificationStatus:z.enum(["VERIFIED","UNVERIFIED"]),reason:ReasonSchema,sourceAnswerId:z.uuid().nullable(),...support}).strict()}).strict(),
 z.object({...envelope,command:z.literal("REVERT_OVERRIDE"),payload:z.object({overrideId:z.uuid(),reason:ReasonSchema}).strict()}).strict(),
 z.object({...envelope,command:z.literal("REVIEW_HYPOTHESIS"),payload:z.object({sourceKind:z.enum(["BRIEFING","EVIDENCE"]),sourceId:z.uuid(),hypothesisIndex:z.number().int().nonnegative().nullable(),sourceHash:z.string().regex(/^[a-f0-9]{64}$/),status:z.enum(["CONFIRMED","REJECTED"]),reason:ReasonSchema,...support}).strict()}).strict(),
 ...(["RESOLVE_FLAG","REOPEN_FLAG"] as const).map(command=>z.object({...envelope,command:z.literal(command),payload:z.object({flagId:z.uuid(),reason:ReasonSchema,...support}).strict()}).strict()),
]).superRefine((request,ctx)=>{
 if(request.command==="CREATE_OVERRIDE"){
  const schema=OVERRIDE_VALUES[request.payload.fieldPath];
  if(!schema.safeParse(request.payload.value).success) ctx.addIssue({code:"custom",path:["payload","value"],message:"Valor incompatível com o campo."});
 }
 if("evidenceIds" in request.payload && (request.command==="CREATE_OVERRIDE" && request.payload.verificationStatus==="VERIFIED" || request.command==="REVIEW_HYPOTHESIS" && request.payload.status==="CONFIRMED")){
  if(!request.payload.evidenceIds.length && request.payload.evidenceNote.trim().length<10) ctx.addIssue({code:"custom",path:["payload","evidenceNote"],message:"Informe suporte para a verificação."});
 }
});
export type AdminWorkflowCommand=z.infer<typeof AdminWorkflowCommandSchema>;
export type WorkflowCommand=AdminWorkflowCommand["command"];
export const HistoryCursorSchema=z.object({createdAt:z.iso.datetime({offset:true}),id:z.uuid()}).strict();
export const WorkflowReadSchema=z.object({operation:z.literal("READ"),diagnosticId:z.uuid(),before:HistoryCursorSchema.optional()}).strict();
export const HISTORY_KINDS=["AUDIT","OVERRIDES","HYPOTHESES","FLAGS","QUALIFICATION","BRIEFING"] as const;
export const WorkflowHistorySchema=z.object({operation:z.literal("HISTORY"),diagnosticId:z.uuid(),kind:z.enum(HISTORY_KINDS),before:HistoryCursorSchema.optional()}).strict();
export const WorkflowHistoryResultSchema=z.object({items:z.array(z.object({id:z.uuid(),createdAt:z.iso.datetime({offset:true}),author:z.string(),action:z.string(),reason:z.string().nullable(),details:z.json()}).strict()),nextCursor:HistoryCursorSchema.nullable()}).strict();
export type WorkflowHistoryKind=typeof HISTORY_KINDS[number];
export type WorkflowHistoryResult=z.infer<typeof WorkflowHistoryResultSchema>;
export const AssigneesRequestSchema=z.object({operation:z.literal("LIST_ASSIGNEES"),search:z.string().trim().max(150).default(""),page:z.number().int().min(0).max(1000).default(0)}).strict();

export const WorkflowSummarySchema=z.object({
 diagnosticId:z.uuid(),status:z.enum(REVIEW_STATUSES),priority:z.enum(ADMIN_PRIORITIES),
 assignee:z.object({profileId:z.uuid(),displayName:z.string(),isActive:z.boolean()}).strict().nullable(),
 rowVersion:z.number().int().positive(),diagnosticVersion:z.number().int().positive(),
 analysisRevision:z.number().int().positive(),decisionStale:z.boolean(),qualificationStale:z.boolean(),briefingStale:z.boolean(),
 contactAllowed:z.boolean(),privacyRestricted:z.boolean(),archivedAt:z.iso.datetime({offset:true}).nullable(),
 allowedStatuses:z.array(z.enum(REVIEW_STATUSES)),capabilities:z.record(z.enum(WORKFLOW_COMMANDS),z.boolean()),
}).strict();
export type WorkflowSummary=z.infer<typeof WorkflowSummarySchema>;
export const EffectiveFieldSchema=z.object({
 path:z.string(),value:z.json(),originalValue:z.string().nullable(),structuredValue:z.json(),
 source:z.enum(["STRUCTURED","ORIGINAL","OVERRIDE"]),sourceAnswerId:z.uuid().nullable(),
 overrideId:z.uuid().nullable(),overrideValue:z.json(),verified:z.boolean(),scorable:z.boolean(),confidence:z.number(),stale:z.boolean(),
 overrideProvenance:z.object({version:z.number().int().positive(),authorProfileId:z.uuid(),createdAt:z.iso.datetime({offset:true}),reason:z.string(),verificationStatus:z.string(),evidenceIds:z.array(z.uuid()),evidenceNote:z.string().nullable()}).strict().nullable(),
}).strict();
export type EffectiveField=z.infer<typeof EffectiveFieldSchema>;
export const NoteSchema=z.object({id:z.uuid(),category:z.enum(NOTE_CATEGORIES),body:z.string(),author:z.string(),createdAt:z.iso.datetime({offset:true})}).strict();
export const HypothesisSchema=z.object({sourceKind:z.enum(["BRIEFING","EVIDENCE"]),sourceId:z.uuid(),hypothesisIndex:z.number().nullable(),sourceHash:z.string(),text:z.string(),status:z.enum(["PENDING","CONFIRMED","REJECTED"]),reason:z.string().nullable(),author:z.string().nullable()}).strict();
export const WorkflowReadResultSchema=z.object({
 workflow:WorkflowSummarySchema,fields:z.array(EffectiveFieldSchema),
 notes:z.array(NoteSchema),nextCursor:HistoryCursorSchema.nullable(),hypotheses:z.array(HypothesisSchema),
}).strict();
export type WorkflowReadResult=z.infer<typeof WorkflowReadResultSchema>;
export const WorkflowResultSchema=z.object({
 commandId:z.uuid(),replayed:z.boolean(),workflow:WorkflowSummarySchema,
 entityId:z.uuid().nullable(),entityVersion:z.number().int().nullable(),invalidatedSections:z.array(z.enum(["OVERVIEW","INTERVIEW","QUALIFICATION","FLAGS","BRIEFING","AUDIT","NOTES"])),
}).strict();
export type WorkflowResult=z.infer<typeof WorkflowResultSchema>;

