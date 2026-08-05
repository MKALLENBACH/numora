"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  clearLocalDraft,
  createClientRequestId,
  createDiagnosticClient,
  DiagnosticClientError,
  preserveLocalDraft,
  readLocalDraft,
  toDiagnosticError,
} from "@/features/diagnostic/client/diagnostic-client";
import { isDiagnosticConfigured } from "@/features/diagnostic/client/config";
import type {
  AnswerValue,
  IdentificationValues,
  PreviousAnswer,
  PublicDiagnosticState,
  ReviewSection,
  SaveStatus as SaveStatusValue,
} from "@/features/diagnostic/client/types";

import {
  DiagnosticErrorState,
  EditReviewDialog,
  PreviousAnswersDrawer,
  ResumeDialog,
} from "./DiagnosticDialogs";
import { DiagnosticProgress, SaveStatus } from "./DiagnosticProgress";
import { DiagnosticShell } from "./DiagnosticShell";
import {
  BlockedStep,
  CommercialConsentStep,
  CompletionStep,
  IdentificationStep,
  IntroductionStep,
  PrivacyConsentStep,
  QuestionStep,
  ReviewStep,
} from "./DiagnosticSteps";

type Mutation = () => Promise<PublicDiagnosticState>;
type RetryAction = () => Promise<void>;

export function DiagnosticPage() {
  const client = useMemo(() => createDiagnosticClient(), []);
  const [state, setState] = useState<PublicDiagnosticState | null>(null);
  const [resumeCandidate, setResumeCandidate] = useState<PublicDiagnosticState | null>(null);
  const [showResume, setShowResume] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatusValue>("idle");
  const [error, setError] = useState<DiagnosticClientError | null>(null);
  const [notice, setNotice] = useState("");
  const [previousAnswers, setPreviousAnswers] = useState<ReadonlyArray<PreviousAnswer>>([]);
  const [showPrevious, setShowPrevious] = useState(false);
  const [editingSection, setEditingSection] = useState<ReviewSection | null>(null);
  const [commercialAuthorized, setCommercialAuthorized] = useState<boolean | null>(null);
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);
  const retryRef = useRef<RetryAction | null>(null);
  const draftRequestIdRef = useRef(createClientRequestId());
  const questionStartedAtRef = useRef(new Date().toISOString());
  const generatingReviewRef = useRef(false);

  const currentQuestion = state?.currentQuestion ?? null;

  useEffect(() => {
    if (!currentQuestion || !state) return;
    const draft = readLocalDraft();
    if (draft?.diagnosticId === state.diagnosticId && draft.questionCode === currentQuestion.id) {
      draftRequestIdRef.current = draft.clientRequestId;
      questionStartedAtRef.current = draft.startedAt;
    } else {
      draftRequestIdRef.current = createClientRequestId();
      questionStartedAtRef.current = new Date().toISOString();
    }
    window.requestAnimationFrame(() => questionHeadingRef.current?.focus());
  }, [currentQuestion, state]);

  useEffect(() => {
    if (!state || state.stage !== "REVIEW" || state.review || generatingReviewRef.current) return;
    generatingReviewRef.current = true;
    const requestId = createClientRequestId();
    void runMutation(
      () => client.invokeState("diagnostic-generate-review", sessionPayload(state, requestId)),
      { preserveView: true },
    ).finally(() => {
      generatingReviewRef.current = false;
    });
    // O efeito deve reagir apenas à transição para revisão sem resumo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.stage, state?.review]);

  function applyState(nextState: PublicDiagnosticState) {
    setState(nextState);
    setError(null);
    setNotice("");
    return nextState;
  }

  async function runMutation(
    mutation: Mutation,
    options: { preserveView?: boolean; retryAction?: RetryAction } = {},
  ) {
    setBusy(true);
    setError(null);
    setNotice("");
    setSaveStatus("saving");

    try {
      const nextState = await mutation();
      applyState(nextState);
      setSaveStatus("saved");
      retryRef.current = null;
      return nextState;
    } catch (cause) {
      const nextError = toDiagnosticError(cause);
      if (nextError.code === "STATE_CONFLICT") {
        try {
          const latest = await client.refresh(state ?? undefined);
          applyState(latest);
        } catch {
          // A resposta local continua preservada e o erro original permanece acionável.
        }
        setNotice(nextError.message);
        setSaveStatus("error");
        retryRef.current = null;
      } else if (nextError.code === "VALIDATION_ERROR") {
        setNotice(nextError.message);
        setSaveStatus("error");
        retryRef.current = null;
      } else if (nextError.code === "AI_FALLBACK_ACTIVE") {
        setNotice(nextError.message);
        setSaveStatus("saved");
        retryRef.current = null;
      } else {
        setError(nextError);
        setSaveStatus(nextError.code === "PERSISTENCE_UNAVAILABLE" ? "paused" : "error");
        retryRef.current = nextError.retryable ? (options.retryAction ?? null) : null;
      }
      if (!options.preserveView && nextError.code === "SESSION_EXPIRED") setState(null);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function startNewDiagnostic(requestId = createClientRequestId()) {
    const nextState = await runMutation(
      () => client.start(requestId),
      { retryAction: () => startNewDiagnostic(requestId) },
    );
    if (nextState) {
      setShowResume(false);
      setResumeCandidate(null);
      setPreviousAnswers([]);
      setSaveStatus("saved");
    }
  }

  async function handleStart() {
    if (!isDiagnosticConfigured()) {
      setError(
        new DiagnosticClientError({
          code: "CONFIGURATION_ERROR",
          message:
            "O diagnóstico ainda não está disponível neste ambiente. A configuração de privacidade e conexão precisa ser concluída antes da publicação.",
          retryable: false,
        }),
      );
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const resumable = await client.findResumable();
      if (resumable) {
        setResumeCandidate(resumable);
        setShowResume(true);
        return;
      }
    } catch (cause) {
      const nextError = toDiagnosticError(cause);
      if (nextError.code !== "SESSION_NOT_FOUND") {
        setError(nextError);
        return;
      }
    } finally {
      setBusy(false);
    }
    await startNewDiagnostic();
  }

  function continueResume() {
    if (!resumeCandidate) return;
    applyState(resumeCandidate);
    setShowResume(false);
    setResumeCandidate(null);
    setSaveStatus("saved");
  }

  async function resetAndStartDiagnostic(requestId = createClientRequestId()) {
    await client.clearSession();
    setState(null);
    setResumeCandidate(null);
    setShowResume(false);
    setError(null);
    await startNewDiagnostic(requestId);
  }

  async function restartDiagnostic(
    abandonRequestId = createClientRequestId(),
    startRequestId = createClientRequestId(),
  ) {
    const active = resumeCandidate ?? state;
    if (active && active.status !== "EXPIRED") {
      const abandoned = await runMutation(
        () => client.invokeState("diagnostic-abandon", sessionPayload(active, abandonRequestId)),
        { retryAction: () => restartDiagnostic(abandonRequestId, startRequestId) },
      );
      if (!abandoned) return;
    }
    await resetAndStartDiagnostic(startRequestId);
  }

  async function submitPrivacy(accepted: boolean, requestId = createClientRequestId()) {
    if (!state) return;
    const active = state;
    await runMutation(
      () => client.invokeState("diagnostic-consent", {
          ...sessionPayload(active, requestId),
          type: "PRIVACY",
          decision: accepted ? "ACCEPTED" : "DECLINED",
          policyVersion: "mvp-v1",
        }),
      { retryAction: () => submitPrivacy(accepted, requestId) },
    );
  }

  async function submitCommercial(accepted: boolean, requestId = createClientRequestId()) {
    if (!state) return;
    const active = state;
    setCommercialAuthorized(accepted);
    await runMutation(
      () => client.invokeState("diagnostic-consent", {
          ...sessionPayload(active, requestId),
          type: "COMMERCIAL",
          decision: accepted ? "ACCEPTED" : "DECLINED",
          policyVersion: "mvp-v1",
        }),
      { retryAction: () => submitCommercial(accepted, requestId) },
    );
  }

  async function submitIdentification(values: IdentificationValues, requestId = createClientRequestId()) {
    if (!state) return;
    const active = state;
    await runMutation(
      () => client.invokeState("diagnostic-identification", {
          ...sessionPayload(active, requestId),
          company: {
            name: values.company.trim(),
            industry: values.industry,
            industryOther: values.industryOther.trim() || undefined,
            size: values.companySize,
            revenueRange: values.revenueRange || undefined,
          },
          lead: {
            name: values.name.trim(),
            role: values.role.trim(),
            email: values.email.trim(),
            phone: values.phone.trim() || undefined,
          },
          honeypot: values.website,
        }),
      { retryAction: () => submitIdentification(values, requestId) },
    );
  }

  function updateDraft(value: AnswerValue, displayValue: string) {
    if (!state || !currentQuestion) return;
    preserveLocalDraft({
      diagnosticId: state.diagnosticId,
      questionCode: currentQuestion.id,
      value,
      displayValue,
      clientRequestId: draftRequestIdRef.current,
      startedAt: questionStartedAtRef.current,
      updatedAt: new Date().toISOString(),
    });
  }

  async function submitAnswer(
    value: AnswerValue,
    displayValue: string,
    responseType?: "SKIPPED" | NonNullable<PublicDiagnosticState["currentQuestion"]>["responseType"],
    requestId = draftRequestIdRef.current,
  ) {
    if (!state || !currentQuestion) return;
    const active = state;
    const answeredQuestion = currentQuestion;
    if (responseType !== "SKIPPED") updateDraft(value, displayValue);
    const nextState = await runMutation(
      () => client.invokeState("diagnostic-submit-answer", {
          ...sessionPayload(active, requestId),
          questionCode: answeredQuestion.id,
          questionVersion: answeredQuestion.version,
          responseType: responseType ?? answeredQuestion.responseType,
          value,
          displayValue,
          honeypot: "",
          startedAt: questionStartedAtRef.current,
        }),
      {
        retryAction: () => submitAnswer(value, displayValue, responseType, requestId),
      },
    );
    if (!nextState) return;

    clearLocalDraft();
    setPreviousAnswers((current) => [
      ...current.filter((answer) => answer.questionCode !== answeredQuestion.id),
      { questionCode: answeredQuestion.id, question: answeredQuestion.text, displayValue },
    ]);
  }

  async function updateReview(section: ReviewSection, value: string, requestId = createClientRequestId()) {
    if (!state?.review) return;
    const active = state;
    const reviewVersion = state.review.version;
    const persistedValue = ["systems", "mainImpacts"].includes(section.key)
      ? value.split(",").map((item) => item.trim()).filter(Boolean)
      : value;
    const nextState = await runMutation(
      () => client.invokeState("diagnostic-update-review", {
          ...sessionPayload(active, requestId),
          sectionKey: section.key,
          value: persistedValue,
          reviewVersion,
        }),
      { retryAction: () => updateReview(section, value, requestId) },
    );
    if (nextState) setEditingSection(null);
  }

  async function completeDiagnostic(
    confirmed: PublicDiagnosticState,
    requestId = createClientRequestId(),
  ) {
    await runMutation(
      () => client.invokeState("diagnostic-complete", sessionPayload(confirmed, requestId)),
      { retryAction: () => completeDiagnostic(confirmed, requestId) },
    );
  }

  async function confirmReview(
    confirmRequestId = createClientRequestId(),
    completeRequestId = createClientRequestId(),
  ) {
    if (!state?.review) return;
    const active = state;
    const reviewVersion = state.review.version;
    const confirmed = await runMutation(
      () => client.invokeState("diagnostic-confirm-review", {
          ...sessionPayload(active, confirmRequestId),
          reviewVersion,
        }),
      { retryAction: () => confirmReview(confirmRequestId, completeRequestId) },
    );
    if (!confirmed || ["COMPLETED", "COMPLETED_NO_CONTACT"].includes(confirmed.status)) return;
    await completeDiagnostic(confirmed, completeRequestId);
  }

  async function addReviewInformation() {
    setEditingSection({ key: "additionalInformation", title: "Informação adicional", value: "" });
  }

  async function retry() {
    if (!retryRef.current) return;
    const retryAction = retryRef.current;
    await retryAction();
  }

  const showProgress = state && !["INTRODUCTION", "PRIVACY_CONSENT", "COMMERCIAL_CONSENT", "COMPLETION"].includes(state.stage) && !["BLOCKED", "EXPIRED"].includes(state.status);

  const persistedDraft = currentQuestion && state ? readLocalDraft() : null;
  const initialDraftValue =
    persistedDraft && state && currentQuestion && persistedDraft.diagnosticId === state.diagnosticId && persistedDraft.questionCode === currentQuestion.id
      ? persistedDraft.value
      : null;
  const modalOpen = showResume || showPrevious || Boolean(editingSection);
  const liveStageLabel = state?.progress.currentLabel ?? "Introdução do diagnóstico";

  return (
    <DiagnosticShell
      aside={showProgress ? (
        <div className="diagnostic-flow-status">
          <DiagnosticProgress stage={state.stage} progress={state.progress} />
          <SaveStatus status={saveStatus} />
        </div>
      ) : undefined}
      modalOpen={modalOpen}
    >
      <div className="diagnostic-view" inert={modalOpen ? true : undefined} aria-hidden={modalOpen ? true : undefined}>
        <p className="diagnostic-visually-hidden" aria-live="polite">
          {state ? `Etapa atual: ${liveStageLabel}` : liveStageLabel}
        </p>
        {notice ? <div className="diagnostic-notice" role="status">{notice}</div> : null}
        {error ? (
          <DiagnosticErrorState error={error} onRetry={retryRef.current ? retry : undefined} onRestart={() => resetAndStartDiagnostic()} />
        ) : !state ? (
          <IntroductionStep onStart={handleStart} busy={busy} />
        ) : state.status === "BLOCKED" ? (
          <BlockedStep />
        ) : state.status === "COMPLETING" ? (
          <section className="diagnostic-card diagnostic-card--loading" aria-live="polite">
            <p className="diagnostic-eyebrow">Concluindo com segurança</p>
            <h1>Finalizando seu diagnóstico inicial…</h1>
            <p>Aguarde enquanto registramos as informações confirmadas.</p>
          </section>
        ) : state.status === "COMPLETED" || state.status === "COMPLETED_NO_CONTACT" ? (
          <CompletionStep withContact={state.status === "COMPLETED" || commercialAuthorized === true} />
        ) : state.stage === "PRIVACY_CONSENT" ? (
          <PrivacyConsentStep onAccept={() => submitPrivacy(true)} onDecline={() => submitPrivacy(false)} busy={busy} />
        ) : state.stage === "COMMERCIAL_CONSENT" ? (
          <CommercialConsentStep onSubmit={submitCommercial} busy={busy} />
        ) : state.stage === "IDENTIFICATION" ? (
          <IdentificationStep onSubmit={submitIdentification} busy={busy} />
        ) : state.stage === "REVIEW" && state.review ? (
          <ReviewStep review={state.review} onEdit={setEditingSection} onConfirm={() => confirmReview()} onAdd={addReviewInformation} busy={busy} />
        ) : currentQuestion ? (
          <QuestionStep
            key={currentQuestion.id}
            question={currentQuestion}
            initialValue={initialDraftValue}
            onDraftChange={updateDraft}
            onSubmit={submitAnswer}
            onSkip={currentQuestion.required ? undefined : () => submitAnswer("", "Não informado", "SKIPPED")}
            onReviewPrevious={state.canGoBack && previousAnswers.length ? () => setShowPrevious(true) : undefined}
            busy={busy}
            headingRef={questionHeadingRef}
          />
        ) : (
          <section className="diagnostic-card diagnostic-card--loading" aria-live="polite">
            <p className="diagnostic-eyebrow">Organizando informações</p>
            <h1>Preparando a próxima etapa…</h1>
            <p>Isso pode levar alguns instantes.</p>
          </section>
        )}
      </div>

      {showResume && resumeCandidate ? (
        <ResumeDialog onContinue={continueResume} onRestart={() => restartDiagnostic()} onClose={() => setShowResume(false)} busy={busy} />
      ) : null}
      {showPrevious ? <PreviousAnswersDrawer answers={previousAnswers} onClose={() => setShowPrevious(false)} /> : null}
      {editingSection ? (
        <EditReviewDialog section={editingSection} onSave={(value) => updateReview(editingSection, value)} onClose={() => setEditingSection(null)} busy={busy} />
      ) : null}
    </DiagnosticShell>
  );
}

function sessionPayload(state: PublicDiagnosticState, clientRequestId: string) {
  return {
    diagnosticId: state.diagnosticId,
    sessionId: state.sessionId,
    clientRequestId,
  };
}
