import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, mapPersistenceError } from "./errors.ts";
import { clarificationPublicQuestion, getCatalogQuestion, toPublicQuestion } from "./interview.ts";
import type { Json, PublicDiagnosticState } from "./types.ts";

const LABELS = ["Identificação", "Desafio", "Processo", "Impacto", "Contexto", "Revisão"];
const STEP_IDS = ["IDENTIFICATION", "CHALLENGE", "CURRENT_PROCESS", "IMPACT", "BUYING_CONTEXT", "REVIEW"] as const;
const STAGE_PROGRESS: Record<string, { current: number; label: string }> = {
  INTRODUCTION: { current: 1, label: "Identificação" }, CONSENT: { current: 1, label: "Identificação" },
  IDENTIFICATION: { current: 1, label: "Identificação" }, CHALLENGE: { current: 2, label: "Desafio" },
  PROCESS: { current: 3, label: "Processo" }, IMPACT: { current: 4, label: "Impacto" },
  CONTEXT: { current: 5, label: "Contexto" }, REVIEW: { current: 6, label: "Revisão" },
  COMPLETION: { current: 6, label: "Revisão" },
};

function publicStatus(status: string): PublicDiagnosticState["status"] {
  if (["REVIEW_GENERATING", "REVIEW_PENDING", "REVIEW_EDITING"].includes(status)) return "REVIEW";
  if (status === "COMPLETING") return "COMPLETING";
  if (["COMPLETED", "COMPLETED_NO_CONTACT", "BLOCKED", "EXPIRED"].includes(status)) return status as PublicDiagnosticState["status"];
  if (status === "ABANDONED") return "EXPIRED";
  return "IN_PROGRESS";
}

function publicStage(status: string, stage: string): PublicDiagnosticState["stage"] {
  if (status === "PRIVACY_CONSENT") return "PRIVACY_CONSENT";
  if (status === "COMMERCIAL_CONSENT") return "COMMERCIAL_CONSENT";
  if (["REVIEW_GENERATING", "REVIEW_PENDING", "REVIEW_EDITING"].includes(status)) return "REVIEW";
  if (["COMPLETING", "COMPLETED", "COMPLETED_NO_CONTACT"].includes(status)) return "COMPLETION";
  if (stage === "PROCESS") return "CURRENT_PROCESS";
  if (stage === "CONTEXT") return "BUYING_CONTEXT";
  if (stage === "CONSENT") return "PRIVACY_CONSENT";
  return stage as PublicDiagnosticState["stage"];
}

export async function buildPublicState(admin: SupabaseClient, ownerId: string, diagnosticId?: string): Promise<PublicDiagnosticState> {
  let query = admin.from("diagnostics").select("id,status,current_stage,updated_at").eq("owner_user_id", ownerId).is("archived_at", null).order("updated_at", { ascending: false }).limit(1);
  if (diagnosticId) query = query.eq("id", diagnosticId);
  const { data: rows, error } = await query;
  if (error) throw mapPersistenceError(error);
  const diagnostic = rows?.[0];
  if (!diagnostic) throw new AppError("SESSION_NOT_FOUND", 404);
  const { data: sessions, error: sessionError } = await admin.from("diagnostic_sessions")
    .select("id,status,current_question_code,expires_at").eq("diagnostic_id", diagnostic.id)
    .eq("owner_user_id", ownerId).order("created_at", { ascending: false }).limit(1);
  if (sessionError) throw mapPersistenceError(sessionError);
  const session = sessions?.[0];
  if (!session) throw new AppError("SESSION_NOT_FOUND", 404);

  let review: PublicDiagnosticState["review"] = null;
  if (["REVIEW_PENDING", "REVIEW_EDITING", "COMPLETING", "COMPLETED", "COMPLETED_NO_CONTACT"].includes(diagnostic.status)) {
    const { data: reviews, error: reviewError } = await admin.from("diagnostic_reviews")
      .select("version,status,summary").eq("diagnostic_id", diagnostic.id)
      .in("status", ["PENDING_CONFIRMATION", "CONFIRMED"]).order("version", { ascending: false }).limit(1);
    if (reviewError) throw mapPersistenceError(reviewError);
    if (reviews?.[0]?.summary) review = {
      ...(reviews[0].summary as Record<string, Json>), version: reviews[0].version,
      confirmed: reviews[0].status === "CONFIRMED",
    };
  }

  const progress = STAGE_PROGRESS[diagnostic.current_stage] ?? STAGE_PROGRESS.INTRODUCTION;
  const terminal = ["COMPLETED", "COMPLETED_NO_CONTACT", "BLOCKED", "EXPIRED", "ABANDONED"].includes(diagnostic.status);
  const code = session.current_question_code as string | null;
  const catalogQuestion = code ? getCatalogQuestion(code) : undefined;
  return {
    diagnosticId: diagnostic.id, sessionId: session.id, status: publicStatus(diagnostic.status),
    stage: publicStage(diagnostic.status, diagnostic.current_stage),
    currentQuestion: catalogQuestion ? toPublicQuestion(catalogQuestion) : code ? clarificationPublicQuestion(code) : null,
    progress: {
      currentStep: progress.current, totalSteps: 6, currentLabel: progress.label,
      steps: STEP_IDS.map((id, index) => ({ id, label: LABELS[index], status: index + 1 < progress.current ? "COMPLETED" : index + 1 === progress.current ? "CURRENT" : "UPCOMING" })),
    },
    review, canGoBack: ["CHALLENGE", "CURRENT_PROCESS", "IMPACT", "BUYING_CONTEXT", "REVIEW_PENDING"].includes(diagnostic.status),
    canResume: !terminal && new Date(session.expires_at).getTime() > Date.now() && ["ACTIVE", "PAUSED"].includes(session.status), saveStatus: "SAVED",
  };
}

export async function diagnosticRowVersion(admin: SupabaseClient, ownerId: string, diagnosticId: string): Promise<number> {
  const { data, error } = await admin.from("diagnostics").select("row_version").eq("id", diagnosticId).eq("owner_user_id", ownerId).maybeSingle();
  if (error) throw mapPersistenceError(error);
  if (!data) throw new AppError("UNAUTHORIZED", 401);
  return data.row_version;
}

export async function assertOwnedDiagnostic(admin: SupabaseClient, ownerId: string, diagnosticId: string) {
  const { data, error } = await admin.from("diagnostics").select("id,status,current_stage,lead_id,created_at,row_version").eq("id", diagnosticId).eq("owner_user_id", ownerId).maybeSingle();
  if (error) throw mapPersistenceError(error);
  if (!data) throw new AppError("UNAUTHORIZED", 401);
  return data;
}
