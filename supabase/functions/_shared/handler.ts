import { z } from "zod";
import { authenticate } from "./auth.ts";
import { corsHeaders, preflightResponse } from "./cors.ts";
import { AppError, errorResponse, mapPersistenceError, referenceCode } from "./errors.ts";
import { reviseReview } from "./ai.ts";
import { assertOwnedDiagnostic, buildPublicState, diagnosticRowVersion } from "./public-state.ts";
import {
  appendProposedAnswer, clarificationPublicQuestion, createInterviewContext,
  flattenStructuredData, missingCriticalPaths, parseClarificationCode, selectNextAction,
  type StoredAnswer, type StoredEvidence, toPublicQuestion, validateCatalogAnswer,
} from "./interview.ts";
import {
  calculateQualification, DeterministicInterviewAIService, determineInternalRoute,
  evaluateFlags,
} from "./generated/domain-runtime.js";
import { detectsAbuse, detectsPromptInjection, redactValue, sha256, stringifyDisplayValue } from "./redaction.ts";
import type { EndpointName, Json, PublicDiagnosticState, RequestContext } from "./types.ts";
import {
  AbandonSchema, ActionSchema, AnswerSchema, CompleteSchema, ConfirmReviewSchema,
  ConsentSchema, GenerateReviewSchema, IdentificationSchema, StartSchema, StateSchema,
  UpdateReviewSchema,
} from "./validation.ts";

type StartInput = z.infer<typeof StartSchema>;
type ConsentInput = z.infer<typeof ConsentSchema>;
type IdentificationInput = z.infer<typeof IdentificationSchema>;
type StateInput = z.infer<typeof StateSchema>;
type AnswerInput = z.infer<typeof AnswerSchema>;
type ActionInput = z.infer<typeof ActionSchema>;
type GenerateReviewInput = z.infer<typeof GenerateReviewSchema>;
type UpdateReviewInput = z.infer<typeof UpdateReviewSchema>;
type ConfirmReviewInput = z.infer<typeof ConfirmReviewSchema>;
type CompleteInput = z.infer<typeof CompleteSchema>;
type AbandonInput = z.infer<typeof AbandonSchema>;

const MAX_BODY_BYTES = 64 * 1024;
const deterministicAI = new DeterministicInterviewAIService();

function integerEnv(name: string, fallback: number, min: number, max: number): number {
  const value = Number(Deno.env.get(name) ?? fallback);
  return Number.isFinite(value) ? Math.min(Math.max(Math.trunc(value), min), max) : fallback;
}

function parse(endpoint: EndpointName, body: unknown): unknown {
  const schema = endpoint === "diagnostic-start" ? StartSchema
    : endpoint === "diagnostic-consent" ? ConsentSchema
    : endpoint === "diagnostic-identification" ? IdentificationSchema
    : endpoint === "diagnostic-state" ? StateSchema
    : endpoint === "diagnostic-submit-answer" ? AnswerSchema
    : endpoint === "diagnostic-next-action" ? ActionSchema
    : endpoint === "diagnostic-generate-review" ? GenerateReviewSchema
    : endpoint === "diagnostic-update-review" ? UpdateReviewSchema
    : endpoint === "diagnostic-confirm-review" ? ConfirmReviewSchema
    : endpoint === "diagnostic-complete" ? CompleteSchema
    : AbandonSchema;
  return schema.parse(body);
}

async function requestBody(request: Request): Promise<unknown> {
  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (declaredSize > MAX_BODY_BYTES) throw new AppError("VALIDATION_ERROR", 413);
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new AppError("VALIDATION_ERROR", 413);
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new AppError("VALIDATION_ERROR", 422);
  }
}

async function rpc(ctx: RequestContext, name: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await ctx.admin.rpc(name, args);
  if (error) throw mapPersistenceError(error);
  return data;
}

async function rateLimit(ctx: RequestContext, scope: string, max: number, windowSeconds: number) {
  const accepted = await rpc(ctx, "diagnostic_consume_rate_limit", {
    p_owner_user_id: ctx.user.id,
    p_scope: scope,
    p_max_requests: max,
    p_window_seconds: windowSeconds,
  });
  if (!accepted) throw new AppError("RATE_LIMITED", 429);
}

const idem = (userId: string, diagnosticId: string | undefined, action: string, requestId: string) =>
  `${userId}:${diagnosticId ?? "new"}:${action}:${requestId}`;

const requestHash = (value: unknown) => sha256(JSON.stringify(value));

type IdempotencyAttempt = {
  key: string;
  hash: string;
  replayedState: PublicDiagnosticState | null;
};

async function prepareIdempotency(
  ctx: RequestContext,
  diagnosticId: string | undefined,
  keyAction: string,
  persistedAction: string,
  requestId: string,
  body: unknown,
): Promise<IdempotencyAttempt> {
  const key = idem(ctx.user.id, diagnosticId, keyAction, requestId);
  const hash = await requestHash(body);
  const { data, error } = await ctx.admin.from("idempotency_records")
    .select("diagnostic_id,action,request_hash,status,response_json")
    .eq("owner_user_id", ctx.user.id)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error) throw mapPersistenceError(error);
  if (!data) return { key, hash, replayedState: null };
  if (
    data.action !== persistedAction || data.request_hash !== hash ||
    (diagnosticId !== undefined && data.diagnostic_id !== diagnosticId)
  ) {
    throw new AppError("VALIDATION_ERROR", 422);
  }
  if (data.status !== "COMPLETED") return { key, hash, replayedState: null };
  const persistedResponse = data.response_json as Record<string, Json> | null;
  const replayDiagnosticId = diagnosticId ?? (
    typeof persistedResponse?.diagnosticId === "string" ? persistedResponse.diagnosticId : undefined
  );
  return {
    key,
    hash,
    replayedState: await buildPublicState(ctx.admin, ctx.user.id, replayDiagnosticId),
  };
}

function responseType(value: string): string {
  return ({ SHORT_TEXT: "TEXT", YES_NO: "BOOLEAN", CURRENCY_RANGE: "SINGLE_CHOICE", DATE: "TEXT", CONFIRMATION: "BOOLEAN" } as Record<string, string>)[value] ?? value;
}

function classifyEmail(email: string): "CORPORATE" | "PERSONAL" | "TEMPORARY" {
  const domain = email.toLowerCase().split("@")[1] ?? "";
  if (["mailinator.com", "10minutemail.com", "guerrillamail.com", "tempmail.com", "yopmail.com"].includes(domain)) return "TEMPORARY";
  if (["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com", "live.com"].includes(domain)) return "PERSONAL";
  return "CORPORATE";
}

function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return withCountry.length >= 10 && withCountry.length <= 15 ? `+${withCountry}` : null;
}

async function audit(ctx: RequestContext, diagnosticId: string, sessionId: string, eventType: string, metadata: Record<string, Json> = {}) {
  const { error } = await ctx.admin.from("audit_events").insert({
    diagnostic_id: diagnosticId,
    session_id: sessionId,
    owner_user_id: ctx.user.id,
    event_type: eventType,
    actor_type: "ANONYMOUS_USER",
    metadata,
  });
  if (error) throw mapPersistenceError(error);
}

async function loadInterviewContext(ctx: RequestContext, diagnosticId: string, sessionId?: string) {
  const diagnostic = await assertOwnedDiagnostic(ctx.admin, ctx.user.id, diagnosticId);
  let sessionQuery = ctx.admin.from("diagnostic_sessions")
    .select("id,status,current_stage,current_question_code,expires_at,total_question_count,clarification_count")
    .eq("diagnostic_id", diagnosticId).eq("owner_user_id", ctx.user.id)
    .order("created_at", { ascending: false }).limit(1);
  if (sessionId) sessionQuery = sessionQuery.eq("id", sessionId);
  const { data: sessions, error: sessionError } = await sessionQuery;
  if (sessionError) throw mapPersistenceError(sessionError);
  const session = sessions?.[0];
  if (!session) throw new AppError("SESSION_NOT_FOUND", 404);
  if (new Date(session.expires_at).getTime() <= Date.now()) throw new AppError("SESSION_EXPIRED", 410);

  const [
    { data: answers, error: answerError },
    { data: evidence, error: evidenceError },
    { data: consents, error: consentError },
    { data: flags, error: flagError },
  ] = await Promise.all([
    ctx.admin.from("interview_answers")
      .select("id,question_code,question_version,response_type,raw_value,normalized_value,display_value,validation_status,revision,created_at")
      .eq("diagnostic_id", diagnosticId).eq("owner_user_id", ctx.user.id).eq("is_current", true)
      .order("created_at", { ascending: true }),
    ctx.admin.from("evidence_items")
      .select("answer_id,target_path,source_type,text,confidence")
      .eq("diagnostic_id", diagnosticId),
    ctx.admin.from("consent_records").select("consent_type,decision,policy_version")
      .eq("diagnostic_id", diagnosticId).order("occurred_at", { ascending: false }),
    ctx.admin.from("diagnostic_flags").select("code").eq("diagnostic_id", diagnosticId).eq("status", "ACTIVE"),
  ]);
  if (answerError) throw mapPersistenceError(answerError);
  if (evidenceError) throw mapPersistenceError(evidenceError);
  if (consentError) throw mapPersistenceError(consentError);
  if (flagError) throw mapPersistenceError(flagError);

  let lead: Record<string, unknown> | null = null;
  let company: Record<string, unknown> | null = null;
  if (diagnostic.lead_id) {
    const { data, error } = await ctx.admin.from("leads")
      .select("id,company_id,name,role,email,phone_e164").eq("id", diagnostic.lead_id)
      .eq("owner_user_id", ctx.user.id).maybeSingle();
    if (error) throw mapPersistenceError(error);
    lead = data;
    if (data?.company_id) {
      const companyResult = await ctx.admin.from("companies")
        .select("id,name,industry,industry_other,employee_range,revenue_range")
        .eq("id", data.company_id).maybeSingle();
      if (companyResult.error) throw mapPersistenceError(companyResult.error);
      company = companyResult.data;
    }
  }
  const context = createInterviewContext({
    diagnostic: { status: diagnostic.status, created_at: diagnostic.created_at },
    session: { expires_at: session.expires_at },
    answers: (answers ?? []) as StoredAnswer[],
    evidence: (evidence ?? []) as StoredEvidence[],
    consents: consents ?? [], lead, company,
    signals: (flags ?? []).map((flag) => flag.code),
  });
  return { diagnostic, session, context };
}

async function handleStart(ctx: RequestContext, body: StartInput) {
  const attempt = await prepareIdempotency(ctx, undefined, "start", "START", body.clientRequestId, body);
  if (attempt.replayedState) return attempt.replayedState;
  await rateLimit(ctx, "diagnostic-start", integerEnv("RATE_LIMIT_MAX_STARTS_PER_HOUR", 3, 1, 100), 3600);
  await rpc(ctx, "diagnostic_start", {
    p_owner_user_id: ctx.user.id,
    p_idempotency_key: attempt.key,
    p_request_hash: attempt.hash,
    p_locale: body.locale,
    p_timezone: body.timezone,
    p_ttl_days: integerEnv("DIAGNOSTIC_SESSION_TTL_DAYS", 7, 1, 30),
  });
  return buildPublicState(ctx.admin, ctx.user.id);
}

async function handleConsent(ctx: RequestContext, body: ConsentInput) {
  const attempt = await prepareIdempotency(ctx, body.diagnosticId, "consent", "CONSENT", body.clientRequestId, body);
  if (attempt.replayedState) return attempt.replayedState;
  await rpc(ctx, "diagnostic_record_consent", {
    p_owner_user_id: ctx.user.id,
    p_diagnostic_id: body.diagnosticId,
    p_session_id: body.sessionId,
    p_consent_type: body.type,
    p_decision: body.decision,
    p_policy_version: body.policyVersion,
    p_idempotency_key: attempt.key,
    p_request_hash: attempt.hash,
    p_expected_row_version: body.rowVersion ?? null,
  });
  return buildPublicState(ctx.admin, ctx.user.id, body.diagnosticId);
}

async function handleIdentification(ctx: RequestContext, body: IdentificationInput) {
  const attempt = await prepareIdempotency(ctx, body.diagnosticId, "identification", "IDENTIFICATION", body.clientRequestId, body);
  if (attempt.replayedState) return attempt.replayedState;
  const { phone, phoneE164, ...leadRest } = body.lead;
  const safety = await redactValue({ company: body.company, lead: leadRest }, "identification");
  if (safety.redactions.length) throw new AppError("VALIDATION_ERROR", 422);
  const emailType = classifyEmail(body.lead.email);
  if (emailType === "TEMPORARY") throw new AppError("VALIDATION_ERROR", 422, { email: "Para continuar, precisamos de um endereço de e-mail permanente." });
  await rpc(ctx, "diagnostic_save_identification", {
    p_owner_user_id: ctx.user.id,
    p_diagnostic_id: body.diagnosticId,
    p_session_id: body.sessionId,
    p_company: { ...body.company, employeeRange: body.company.employeeRange ?? body.company.size },
    p_lead: { ...body.lead, phoneE164: body.lead.phoneE164 ?? normalizePhone(body.lead.phone), emailType, emailValidated: true },
    p_idempotency_key: attempt.key,
    p_request_hash: attempt.hash,
    p_expected_row_version: body.rowVersion ?? null,
  });
  return buildPublicState(ctx.admin, ctx.user.id, body.diagnosticId);
}

async function securityFlags(ctx: RequestContext, diagnosticId: string, display: string, hasSensitive: boolean, severe: boolean) {
  const flags: Array<Record<string, string>> = [];
  if (hasSensitive) flags.push({
    code: severe ? "SEVERE_SENSITIVE_DATA_EXPOSURE" : "SENSITIVE_DATA_SHARED",
    displayName: "Conteúdo sensível detectado", severity: severe ? "S3" : "S1",
    reason: "Conteúdo removido automaticamente antes da persistência.",
    schedulingEffect: severe ? "BLOCK_ALL" : "NONE", recommendedRoute: severe ? "BLOCKED" : "",
  });
  for (const [matches, code] of [[detectsPromptInjection(display), "PROMPT_INJECTION_ATTEMPT"], [detectsAbuse(display), "PERSISTENT_ABUSE"]] as const) {
    if (!matches) continue;
    const { data } = await ctx.admin.from("diagnostic_flags").select("id").eq("diagnostic_id", diagnosticId).eq("code", code).eq("status", "ACTIVE").limit(1);
    const persistent = Boolean(data?.length);
    flags.push({
      code: persistent && code === "PROMPT_INJECTION_ATTEMPT" ? "PERSISTENT_PROMPT_INJECTION" : code,
      displayName: "Uso fora da finalidade", severity: persistent ? "S3" : "S1",
      reason: "Padrão de abuso detectado sem armazenar o conteúdo.",
      schedulingEffect: persistent ? "BLOCK_ALL" : "NONE", recommendedRoute: persistent ? "BLOCKED" : "",
    });
  }
  return flags;
}

async function handleAnswer(ctx: RequestContext, body: AnswerInput) {
  const attempt = await prepareIdempotency(ctx, body.diagnosticId, "submit-answer", "SUBMIT_ANSWER", body.clientRequestId, body);
  if (attempt.replayedState) return attempt.replayedState;
  await rateLimit(
    ctx,
    "diagnostic-submit-answer",
    integerEnv("RATE_LIMIT_MAX_ANSWER_SUBMISSIONS", 10, 1, 300),
    integerEnv("RATE_LIMIT_WINDOW_SECONDS", 60, 1, 3600),
  );
  const loaded = await loadInterviewContext(ctx, body.diagnosticId, body.sessionId);
  if (loaded.session.current_question_code !== body.questionCode) throw new AppError("STATE_CONFLICT", 409);
  const elapsed = body.elapsedMs ?? (body.startedAt ? Date.now() - new Date(body.startedAt).getTime() : 0);
  if (elapsed < integerEnv("DIAGNOSTIC_MIN_ANSWER_MS", 350, 0, 10000)) throw new AppError("VALIDATION_ERROR", 422);
  const redacted = await redactValue(body.value);
  const display = body.responseType === "SKIPPED"
    ? "Não informado"
    : stringifyDisplayValue(redacted.value).slice(0, 10000);
  const validated = validateCatalogAnswer({
    currentQuestionCode: body.questionCode, questionVersion: body.questionVersion,
    responseType: body.responseType, value: redacted.value,
  });
  const skipped = body.responseType === "SKIPPED";
  const answerQuestion = validated.question
    ? toPublicQuestion(validated.question)
    : clarificationPublicQuestion(body.questionCode);
  if (!answerQuestion) throw new AppError("STATE_CONFLICT", 409);
  const extraction = skipped
    ? { fields: [], responseClarity: "CLEAR" as const }
    : await deterministicAI.extractAnswer({
      question: answerQuestion,
      answer: validated.value,
      targetPaths: [...(validated.question?.targetPaths ?? [])],
      knownData: flattenStructuredData(loaded.context.structuredData),
    });
  const flags = await securityFlags(ctx, body.diagnosticId, display, redacted.redactions.length > 0, redacted.redactions.some((item) => item.severe));
  const severeSecurityFlag = flags.some((flag) => flag.severity === "S3");
  const validationStatus = skipped
    ? "NOT_CONFIRMED"
    : redacted.redactions.length
      ? "REDACTED"
      : extraction.responseClarity === "CLEAR" ? "VALID" : "NOT_CONFIRMED";
  const extractedFields = skipped || redacted.redactions.length
    ? []
    : extraction.fields;
  const acceptedFields = extractedFields.filter((field) =>
    field.confidence >= 0.85 &&
    field.sourceType !== "AI_INFERENCE" &&
    field.sourceType !== "NOT_CONFIRMED"
  );
  const normalizedFields = Object.fromEntries(
    acceptedFields.map((field) => [field.path, field.value as Json]),
  );
  const proposed = appendProposedAnswer(loaded.context, {
    code: body.questionCode,
    value: validated.value,
    clarity: redacted.redactions.length ? "VAGUE" : extraction.responseClarity,
    skipped,
    normalizedFields,
  });
  const action = severeSecurityFlag ? null : selectNextAction(proposed);
  const blocked = severeSecurityFlag || action?.type === "BLOCK";
  const nextStatus = blocked ? "BLOCKED"
    : action?.type === "GENERATE_REVIEW" ? "REVIEW_GENERATING"
    : action?.type === "ASK_QUESTION" ? action.question.stage
    : loaded.diagnostic.status;
  const nextStage = blocked ? loaded.diagnostic.current_stage
    : action?.type === "GENERATE_REVIEW" ? "REVIEW"
    : action?.type === "ASK_QUESTION"
      ? action.question.stage === "CURRENT_PROCESS" ? "PROCESS" : action.question.stage === "BUYING_CONTEXT" ? "CONTEXT" : action.question.stage
      : loaded.diagnostic.current_stage;
  const nextCode = action?.type === "ASK_QUESTION" ? action.question.id
    : action?.type === "ASK_CLARIFICATION" ? action.question.id : null;
  const currentClarification = parseClarificationCode(body.questionCode);
  const answerEvidence = extractedFields.map((field) => ({
    targetPath: field.path,
    sourceType: field.confidence >= 0.85 && field.sourceType !== "AI_INFERENCE"
      ? field.sourceType
      : "NOT_CONFIRMED" as const,
    text: field.evidenceText.slice(0, 500),
    confidence: field.confidence,
  }));
  const totalAfter = proposed.askedQuestionIds.length + proposed.clarifications.length;
  await rpc(ctx, "diagnostic_submit_answer", {
    p_owner_user_id: ctx.user.id,
    p_diagnostic_id: body.diagnosticId,
    p_session_id: body.sessionId,
    p_question_code: body.questionCode,
    p_question_version: body.questionVersion,
    p_response_type: responseType(body.responseType),
    p_raw_value: redacted.value,
    p_normalized_value: normalizedFields,
    p_display_value: display,
    p_validation_status: validationStatus,
    p_source_type: skipped
      ? "NOT_CONFIRMED"
      : answerEvidence[0]?.sourceType ?? (validated.isClarification ? "REPORTED_FACT" : "NOT_CONFIRMED"),
    p_confidence: skipped ? 0 : answerEvidence[0]?.confidence ?? (validated.isClarification ? 1 : 0),
    p_confirmed: !skipped && validationStatus === "VALID",
    p_redacted: redacted.redactions.length > 0,
    p_redactions: redacted.redactions,
    p_security_flags: flags,
    p_evidence: answerEvidence,
    p_is_clarification: validated.isClarification,
    p_question_metadata: currentClarification ? {
      relatedQuestionId: currentClarification.relatedQuestionId,
      clarificationType: currentClarification.type,
      sequence: currentClarification.sequence,
    } : {},
    p_next_status: nextStatus,
    p_next_stage: nextStage,
    p_next_question_code: blocked ? null : nextCode,
    p_completion_percentage: blocked ? 0 : Math.min(85, Math.round(10 + (totalAfter / 18) * 75)),
    p_idempotency_key: attempt.key,
    p_request_hash: attempt.hash,
    p_expected_row_version: body.rowVersion,
  });
  return buildPublicState(ctx.admin, ctx.user.id, body.diagnosticId);
}

async function reviewInputs(ctx: RequestContext, diagnosticId: string, sessionId?: string) {
  const loaded = await loadInterviewContext(ctx, diagnosticId, sessionId);
  const answers = Object.fromEntries(loaded.context.answers.map((answer) => [
    answer.questionId,
    typeof answer.value === "string" ? answer.value : stringifyDisplayValue(answer.value),
  ]));
  const company = String(loaded.context.structuredData.lead.company ?? "Não informado");
  return { ...loaded, answers, company };
}

async function handleGenerateReview(ctx: RequestContext, body: GenerateReviewInput) {
  const attempt = await prepareIdempotency(ctx, body.diagnosticId, "generate-review", "GENERATE_REVIEW", body.clientRequestId, body);
  if (attempt.replayedState) return attempt.replayedState;
  const inputs = await reviewInputs(ctx, body.diagnosticId, body.sessionId);
  const canonicalDraft = await deterministicAI.generateReview({
    structuredData: flattenStructuredData(inputs.context.structuredData),
  });
  const generated = await reviseReview(canonicalDraft);
  if (generated.fallbackUsed) {
    await ctx.admin.from("technical_errors").insert({
      diagnostic_id: body.diagnosticId, session_id: body.sessionId, owner_user_id: ctx.user.id,
      error_type: "AI", error_code: "AI_PROVIDER_UNAVAILABLE", reference_code: ctx.referenceCode,
      safe_context: { fallbackUsed: true },
    });
  }
  await rpc(ctx, "diagnostic_generate_review", {
    p_owner_user_id: ctx.user.id, p_diagnostic_id: body.diagnosticId, p_session_id: body.sessionId,
    p_summary: generated.review, p_provider_mode: generated.mode, p_fallback_used: generated.fallbackUsed,
    p_idempotency_key: attempt.key,
    p_request_hash: attempt.hash,
  });
  return buildPublicState(ctx.admin, ctx.user.id, body.diagnosticId);
}

async function handleUpdateReview(ctx: RequestContext, body: UpdateReviewInput) {
  const attempt = await prepareIdempotency(ctx, body.diagnosticId, "update-review", "UPDATE_REVIEW", body.clientRequestId, body);
  if (attempt.replayedState) return attempt.replayedState;
  await assertOwnedDiagnostic(ctx.admin, ctx.user.id, body.diagnosticId);
  const section = body.sectionKey === "additionalInformation" ? "decisionContext" : body.sectionKey;
  const { data: current } = await ctx.admin.from("diagnostic_reviews").select("version,summary").eq("diagnostic_id", body.diagnosticId).eq("status", "PENDING_CONFIRMATION").order("version", { ascending: false }).limit(1);
  if (current?.[0]?.version !== body.reviewVersion) throw new AppError("STATE_CONFLICT", 409);
  const safe = await redactValue(body.value, `review.${section}`);
  if (safe.redactions.length) throw new AppError("VALIDATION_ERROR", 422);
  let persistedValue: Json = ["systems", "mainImpacts"].includes(section) && typeof safe.value === "string"
    ? safe.value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 20)
    : safe.value;
  if (body.sectionKey === "additionalInformation" && typeof persistedValue === "string") {
    const existing = (current?.[0]?.summary as Record<string, Json> | undefined)?.decisionContext;
    persistedValue = `${typeof existing === "string" ? `${existing}\n` : ""}${persistedValue}`.slice(0, 800);
  }
  await rpc(ctx, "diagnostic_update_review", {
    p_owner_user_id: ctx.user.id, p_diagnostic_id: body.diagnosticId, p_session_id: body.sessionId,
    p_section: section, p_value: persistedValue,
    p_review_version: body.reviewVersion,
    p_idempotency_key: attempt.key,
    p_request_hash: attempt.hash,
  });
  return buildPublicState(ctx.admin, ctx.user.id, body.diagnosticId);
}

async function completionArtifacts(
  review: Record<string, Json>,
  context: ReturnType<typeof createInterviewContext>,
) {
  const completionState = { ...context, status: "COMPLETING", review, reviewConfirmed: true };
  const assessment = calculateQualification({
    structuredData: context.structuredData,
    evidence: context.evidence,
  });
  const flags = evaluateFlags({ state: completionState, assessment });
  const route = determineInternalRoute({
    privacyConsent: context.privacyConsent,
    commercialConsent: context.commercialConsent,
    flags,
    assessment,
  });
  const canonicalBriefing = await new DeterministicInterviewAIService().generateBriefing({
    structuredData: flattenStructuredData(context.structuredData),
    review,
    missingCriticalPaths: missingCriticalPaths(context),
  });
  const recommendedOffer = ["BLOCKED", "OUT_OF_SCOPE", "NO_CONTACT"].includes(route.route)
    ? "NO_OFFER"
    : route.route === "MANUAL_REVIEW"
      ? "MANUAL_EVALUATION"
      : route.route === "NURTURE"
        ? "EXPLORATORY_CONVERSATION"
        : "NUMORA_DIAGNOSE";
  return {
    assessment: {
      version: assessment.version,
      earnedPoints: assessment.earnedPoints,
      assessedWeight: assessment.assessedWeight,
      normalizedScore: assessment.normalizedScore ?? "",
      finalScore: assessment.finalScore ?? "",
      scoreCapApplied: assessment.scoreCapApplied ?? "",
      classification: assessment.classification,
      confidence: assessment.assessmentConfidence,
      recommendedRoute: route.route,
      criteria: assessment.criteria,
    },
    flags: flags.map((flag) => ({ ...flag, recommendedRoute: "", metadata: {} })),
    briefing: { ...canonicalBriefing, recommendedOffer },
  };
}

async function handleComplete(ctx: RequestContext, body: CompleteInput) {
  const attempt = await prepareIdempotency(ctx, body.diagnosticId, "complete", "COMPLETE", body.clientRequestId, body);
  if (attempt.replayedState) return attempt.replayedState;
  const inputs = await reviewInputs(ctx, body.diagnosticId, body.sessionId);
  const { data: reviews } = await ctx.admin.from("diagnostic_reviews").select("summary").eq("diagnostic_id", body.diagnosticId).eq("status", "CONFIRMED").order("version", { ascending: false }).limit(1);
  if (!reviews?.[0]?.summary) throw new AppError("STATE_CONFLICT", 409);
  const artifacts = await completionArtifacts(
    reviews[0].summary as Record<string, Json>,
    inputs.context,
  );
  await rpc(ctx, "diagnostic_complete", {
    p_owner_user_id: ctx.user.id, p_diagnostic_id: body.diagnosticId, p_session_id: body.sessionId,
    p_assessment: artifacts.assessment, p_flags: artifacts.flags, p_briefing: artifacts.briefing,
    p_idempotency_key: attempt.key,
    p_request_hash: attempt.hash,
  });
  return buildPublicState(ctx.admin, ctx.user.id, body.diagnosticId);
}

async function stateForIdentity(
  ctx: RequestContext,
  input: { diagnosticId?: string; sessionId?: string },
): Promise<PublicDiagnosticState> {
  const state = await buildPublicState(ctx.admin, ctx.user.id, input.diagnosticId);
  if (input.sessionId && state.sessionId !== input.sessionId) {
    throw new AppError("SESSION_NOT_FOUND", 404);
  }
  return state;
}

async function dispatch(endpoint: EndpointName, ctx: RequestContext, body: unknown): Promise<unknown> {
  if (endpoint === "diagnostic-start") return handleStart(ctx, body as StartInput);
  if (endpoint === "diagnostic-consent") return handleConsent(ctx, body as ConsentInput);
  if (endpoint === "diagnostic-identification") return handleIdentification(ctx, body as IdentificationInput);
  if (endpoint === "diagnostic-state") {
    const input = body as StateInput;
    const state = await stateForIdentity(ctx, input);
    await audit(ctx, state.diagnosticId, state.sessionId, "STATE_ACCESSED");
    return state;
  }
  if (endpoint === "diagnostic-submit-answer") return handleAnswer(ctx, body as AnswerInput);
  if (endpoint === "diagnostic-next-action") {
    const input = body as ActionInput;
    const state = await stateForIdentity(ctx, input);
    await audit(ctx, state.diagnosticId, state.sessionId, "NEXT_ACTION_ACCESSED");
    return state;
  }
  if (endpoint === "diagnostic-generate-review") return handleGenerateReview(ctx, body as GenerateReviewInput);
  if (endpoint === "diagnostic-update-review") return handleUpdateReview(ctx, body as UpdateReviewInput);
  if (endpoint === "diagnostic-confirm-review") {
    const input = body as ConfirmReviewInput;
    const attempt = await prepareIdempotency(ctx, input.diagnosticId, "confirm-review", "CONFIRM_REVIEW", input.clientRequestId, input);
    if (attempt.replayedState) return attempt.replayedState;
    await assertOwnedDiagnostic(ctx.admin, ctx.user.id, input.diagnosticId);
    const { data: current } = await ctx.admin.from("diagnostic_reviews").select("version").eq("diagnostic_id", input.diagnosticId).eq("status", "PENDING_CONFIRMATION").order("version", { ascending: false }).limit(1);
    if (current?.[0]?.version !== input.reviewVersion) throw new AppError("STATE_CONFLICT", 409);
    await rpc(ctx, "diagnostic_confirm_review", {
      p_owner_user_id: ctx.user.id, p_diagnostic_id: input.diagnosticId, p_session_id: input.sessionId,
      p_review_version: input.reviewVersion,
      p_idempotency_key: attempt.key,
      p_request_hash: attempt.hash,
    });
    return buildPublicState(ctx.admin, ctx.user.id, input.diagnosticId);
  }
  if (endpoint === "diagnostic-complete") return handleComplete(ctx, body as CompleteInput);
  const input = body as AbandonInput;
  const attempt = await prepareIdempotency(ctx, input.diagnosticId, "abandon", "ABANDON", input.clientRequestId, input);
  if (attempt.replayedState) return attempt.replayedState;
  await rpc(ctx, "diagnostic_abandon", {
    p_owner_user_id: ctx.user.id, p_diagnostic_id: input.diagnosticId, p_session_id: input.sessionId,
    p_idempotency_key: attempt.key,
    p_request_hash: attempt.hash,
  });
  return buildPublicState(ctx.admin, ctx.user.id, input.diagnosticId);
}

export function serveEndpoint(endpoint: EndpointName): void {
  Deno.serve(async (request) => {
    const origin = request.headers.get("origin");
    let headers: Record<string, string> = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
    const code = referenceCode();
    try {
      headers = { ...headers, ...corsHeaders(origin) };
      if (request.method === "OPTIONS") return preflightResponse(request);
      if (request.method !== "POST") throw new AppError("VALIDATION_ERROR", 405);
      const { user, admin } = await authenticate(request);
      const ctx: RequestContext = { user, admin, origin, referenceCode: code };
      await rateLimit(ctx, "diagnostic-global", integerEnv("RATE_LIMIT_MAX_REQUESTS", 30, 1, 300), integerEnv("RATE_LIMIT_WINDOW_SECONDS", 60, 1, 3600));
      const raw = await requestBody(request);
      const body = parse(endpoint, raw);
      const data = await dispatch(endpoint, ctx, body);
      const diagnosticId = data && typeof data === "object" && "diagnosticId" in data
        ? String((data as { diagnosticId: unknown }).diagnosticId) : null;
      const rowVersion = diagnosticId ? await diagnosticRowVersion(admin, user.id, diagnosticId) : null;
      if (rowVersion !== null) headers["X-Diagnostic-Row-Version"] = String(rowVersion);
      return Response.json(
        { data, error: null, ...(rowVersion === null ? {} : { meta: { rowVersion } }) },
        { status: 200, headers },
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fields = Object.fromEntries(error.issues.slice(0, 10).map((issue) => [issue.path.join(".") || "request", "Valor inválido."]));
        return errorResponse(new AppError("VALIDATION_ERROR", 422, fields), code, headers);
      }
      return errorResponse(error, code, headers);
    }
  });
}
