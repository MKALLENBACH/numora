"use client";

import { useSearchParams } from "next/navigation";
import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { withBasePath } from "@/config/runtime";
import { getQuestionById } from "@/features/diagnostic/domain/catalog";

import { getAdminDiagnosticDetail } from "./admin-diagnostic-detail-client";
import { useAdminAuth } from "./AdminAuthProvider";
import { AdminClientError } from "./admin-transport";
import {
  ADMIN_DIAGNOSTIC_TABS,
  type AdminDiagnosticDetailData,
  type AdminDiagnosticDetailSection,
  type AdminDiagnosticTab,
} from "./diagnostic-detail-contract";
import { isDiagnosticId, isDiagnosticTab } from "./diagnostic-detail-navigation";

type DetailDataBySection = Partial<Record<AdminDiagnosticDetailSection, AdminDiagnosticDetailData>>;
type OverviewData = Extract<AdminDiagnosticDetailData, { section: "OVERVIEW" }>;
type InterviewData = Extract<AdminDiagnosticDetailData, { section: "INTERVIEW" }>;
type QualificationData = Extract<AdminDiagnosticDetailData, { section: "QUALIFICATION" }>;
type FlagsData = Extract<AdminDiagnosticDetailData, { section: "FLAGS" }>;
type BriefingData = Extract<AdminDiagnosticDetailData, { section: "BRIEFING" }>;
type AuditData = Extract<AdminDiagnosticDetailData, { section: "AUDIT" }>;
type InterviewAnswer = InterviewData["content"]["answers"][number];

const tabs: readonly { id: AdminDiagnosticTab; label: string; section: AdminDiagnosticDetailSection }[] = [
  { id: "visao-geral", label: "Visão geral", section: "OVERVIEW" },
  { id: "entrevista", label: "Entrevista", section: "INTERVIEW" },
  { id: "qualificacao", label: "Qualificação", section: "QUALIFICATION" },
  { id: "flags", label: "Flags", section: "FLAGS" },
  { id: "briefing", label: "Briefing", section: "BRIEFING" },
  { id: "auditoria", label: "Auditoria", section: "AUDIT" },
];

const statusLabels: Record<string, string> = {
  INTRODUCTION: "Introdução",
  PRIVACY_CONSENT: "Privacidade",
  COMMERCIAL_CONSENT: "Consentimento comercial",
  IDENTIFICATION: "Identificação",
  CHALLENGE: "Desafio",
  CURRENT_PROCESS: "Processo atual",
  IMPACT: "Impacto",
  BUYING_CONTEXT: "Contexto de compra",
  REVIEW_GENERATING: "Gerando revisão",
  REVIEW_PENDING: "Revisão pendente",
  REVIEW_EDITING: "Revisão em edição",
  COMPLETING: "Finalizando",
  COMPLETED: "Concluído",
  COMPLETED_NO_CONTACT: "Concluído sem contato",
  BLOCKED: "Bloqueado",
  EXPIRED: "Expirado",
  ABANDONED: "Abandonado",
  ACTIVE: "Ativa",
  RESOLVED: "Resolvida",
  DRAFT: "Rascunho",
  PENDING_CONFIRMATION: "Aguardando confirmação",
  CONFIRMED: "Confirmada",
  SUPERSEDED: "Substituída",
  FINAL: "Final",
};

const classificationLabels: Record<string, string> = {
  PRIORITY: "Prioritário",
  QUALIFIED: "Qualificado",
  INVESTIGATION: "Em investigação",
  LOW_FIT: "Baixa aderência",
  INSUFFICIENT: "Dados insuficientes",
};

const dimensionLabels: Record<string, string> = {
  NUMORA_FIT: "Aderência à NUMORA",
  PROBLEM_CLARITY: "Clareza do problema",
  OPERATIONAL_IMPACT: "Impacto operacional",
  FINANCIAL_IMPACT: "Impacto financeiro",
  URGENCY: "Urgência",
  DECISION_AND_EXECUTION: "Decisão e execução",
  DATA_AND_FEASIBILITY: "Dados e viabilidade",
};

const stageLabels: Record<string, string> = {
  CHALLENGE: "Desafio",
  CURRENT_PROCESS: "Processo",
  IMPACT: "Impacto",
  BUYING_CONTEXT: "Contexto",
  OTHER: "Outras respostas",
};

const industryLabels: Record<string, string> = {
  INDUSTRY: "Indústria",
  CONSTRUCTION: "Construção civil",
  LOGISTICS: "Logística",
  DISTRIBUTION: "Distribuição",
  HEALTHCARE: "Saúde",
  B2B_SERVICES: "Serviços B2B",
  TECHNOLOGY: "Tecnologia",
  RETAIL: "Varejo",
  FINANCIAL_SERVICES: "Serviços financeiros",
  EDUCATION: "Educação",
  PUBLIC_SECTOR: "Setor público",
  OTHER: "Outro",
};

const employeeRangeLabels: Record<string, string> = {
  UP_TO_10: "Até 10 pessoas",
  "11_50": "11 a 50 pessoas",
  "51_100": "51 a 100 pessoas",
  "101_500": "101 a 500 pessoas",
  "501_1000": "501 a 1.000 pessoas",
  ABOVE_1000: "Mais de 1.000 pessoas",
  NOT_INFORMED: "Não informado",
};

const areaLabels: Record<string, string> = {
  COMMERCIAL: "Comercial",
  FINANCE: "Financeiro",
  CUSTOMER_SERVICE: "Atendimento ao cliente",
  OPERATIONS_LOGISTICS: "Operações e logística",
  PROCUREMENT: "Compras",
  HUMAN_RESOURCES: "Recursos humanos",
  LEGAL: "Jurídico",
  TECHNOLOGY: "Tecnologia",
  OTHER: "Outra área",
};

const priorityLabels: Record<number, string> = {
  1: "Apenas exploratória",
  2: "Importante, sem prazo",
  3: "Próximos meses",
  4: "Iniciar em breve",
  5: "Prioridade imediata",
};

const routeLabels: Record<string, string> = {
  SENIOR_MEETING: "Reunião sênior",
  STANDARD_MEETING: "Reunião padrão",
  EXPLORATORY_MEETING: "Conversa exploratória",
  MANUAL_REVIEW: "Revisão manual",
  NURTURE: "Nutrição",
  OUT_OF_SCOPE: "Fora do escopo",
  BLOCKED: "Bloqueado",
  NO_CONTACT: "Sem contato",
};

const offerLabels: Record<string, string> = {
  NUMORA_DIAGNOSE: "Diagnóstico NUMORA",
  EXPLORATORY_CONVERSATION: "Conversa exploratória",
  MANUAL_EVALUATION: "Avaliação manual",
  NO_OFFER: "Nenhuma oferta",
};

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

const numberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function formatDateTime(value: string | null) {
  if (!value) return "Não informado";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data indisponível" : dateTimeFormatter.format(date);
}

function formatNumber(value: number | null, suffix = "") {
  return value === null ? "Ainda não calculado" : `${numberFormatter.format(value)}${suffix}`;
}

function displayLabel(map: Record<string, string>, value: string | null | undefined) {
  return value ? map[value] ?? value.replaceAll("_", " ") : "Não informado";
}

function DefinitionGrid({ items }: Readonly<{
  items: readonly { label: string; value: React.ReactNode }[];
}>) {
  return (
    <dl className="admin-detail-definition-grid">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value ?? "Não informado"}</dd>
        </div>
      ))}
    </dl>
  );
}

function PrivacyNotice() {
  return (
    <div className="admin-detail-notice" role="note">
      <strong>Conteúdo limitado por privacidade</strong>
      <p>Dados identificáveis e narrativas não estão disponíveis para este diagnóstico.</p>
    </div>
  );
}

function EmptySection({ title, message }: Readonly<{ title: string; message: string }>) {
  return (
    <div className="admin-detail-empty">
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}

function OverviewSection({ data }: Readonly<{ data: OverviewData }>) {
  const { content } = data;
  return (
    <div className="admin-detail-stack">
      {content.privacyRestricted ? <PrivacyNotice /> : null}
      <section className="admin-detail-panel" aria-labelledby="overview-company-title">
        <h2 id="overview-company-title">Empresa e respondente</h2>
        <DefinitionGrid items={[
          { label: "Empresa", value: content.company?.name ?? "Não informado" },
          { label: "Setor", value: displayLabel(industryLabels, content.company?.industry) },
          { label: "Porte", value: displayLabel(employeeRangeLabels, content.company?.employeeRange) },
          { label: "Faixa de faturamento", value: content.company?.revenueRange ?? "Não informado" },
          { label: "Nome", value: content.contact?.name ?? "Não informado" },
          { label: "Cargo ou função", value: content.contact?.role ?? "Não informado" },
          { label: "E-mail profissional", value: content.contact?.email ?? "Não informado" },
          { label: "Telefone profissional", value: content.contact?.phone ?? "Não informado" },
        ]} />
      </section>

      <section className="admin-detail-panel" aria-labelledby="overview-context-title">
        <h2 id="overview-context-title">Contexto declarado</h2>
        <DefinitionGrid items={[
          { label: "Área principal", value: displayLabel(areaLabels, content.primaryArea) },
          {
            label: "Prioridade",
            value: content.declaredPriority
              ? priorityLabels[content.declaredPriority]
              : "Não informado",
          },
          { label: "Etapa atual", value: displayLabel(statusLabels, content.diagnostic.currentStage) },
          { label: "Progresso da entrevista", value: `${formatNumber(content.diagnostic.completionPercentage, "%")}` },
        ]} />
        <div className="admin-detail-prose-block">
          <h3>Resumo executivo</h3>
          <p>{content.executiveSummary ?? "Resumo executivo ainda não disponível."}</p>
        </div>
      </section>

      <section className="admin-detail-panel" aria-labelledby="overview-result-title">
        <h2 id="overview-result-title">Resultado vigente</h2>
        <DefinitionGrid items={[
          { label: "Score", value: formatNumber(content.assessment?.finalScore ?? null, " pontos") },
          { label: "Classificação", value: displayLabel(classificationLabels, content.assessment?.classification) },
          { label: "Confiança", value: displayLabel(statusLabels, content.assessment?.confidence) },
          { label: "Peso avaliado", value: content.assessment ? formatNumber(content.assessment.assessedWeight, "%") : "Ainda não calculado" },
          { label: "Maior flag ativa", value: content.highestActiveFlag ? `${content.highestActiveFlag.severity} · ${content.highestActiveFlag.displayName}` : "Sem flags ativas" },
          { label: "Avaliado em", value: formatDateTime(content.assessment?.calculatedAt ?? null) },
        ]} />
      </section>

      <section className="admin-detail-panel" aria-labelledby="overview-consent-title">
        <h2 id="overview-consent-title">Registro e consentimentos</h2>
        <DefinitionGrid items={[
          { label: "Situação", value: displayLabel(statusLabels, content.diagnostic.status) },
          { label: "Criado em", value: formatDateTime(content.diagnostic.createdAt) },
          { label: "Concluído em", value: formatDateTime(content.diagnostic.completedAt) },
          { label: "Privacidade", value: content.privacyConsent ? `${content.privacyConsent.decision === "ACCEPTED" ? "Aceita" : "Recusada"} · versão ${content.privacyConsent.policyVersion}` : "Não registrada" },
          { label: "Data da privacidade", value: formatDateTime(content.privacyConsent?.occurredAt ?? null) },
          { label: "Contato comercial", value: content.contactAllowed ? "Contato autorizado" : "Contato não autorizado" },
          { label: "Consentimento comercial", value: content.commercialConsent ? (content.commercialConsent.decision === "ACCEPTED" ? "Aceito" : "Recusado") : "Não registrado" },
          { label: "Data do consentimento", value: formatDateTime(content.commercialConsent?.occurredAt ?? null) },
        ]} />
      </section>
    </div>
  );
}

function questionPresentation(answer: InterviewAnswer) {
  const referenceCode = answer.clarificationForCode ?? answer.questionCode;
  const question = getQuestionById(referenceCode);
  const exactVersion = question?.version === answer.questionVersion;
  return {
    stage: question?.stage ?? "OTHER",
    title: answer.clarificationForCode
      ? question
        ? `Esclarecimento sobre: ${question.text}`
        : `Esclarecimento ${answer.questionCode}`
      : exactVersion && question
        ? question.text
        : `Pergunta ${answer.questionCode}`,
    historicalTextUnavailable: !answer.clarificationForCode && !exactVersion,
  };
}

function AnswerCard({ answer, history }: Readonly<{
  answer: InterviewAnswer;
  history: InterviewAnswer[];
}>) {
  const presentation = questionPresentation(answer);
  return (
    <article className="admin-answer-card">
      <header>
        <div>
          <span>{answer.questionCode} · revisão {answer.revision}</span>
          <h3>{presentation.title}</h3>
        </div>
        <span className={`admin-answer-state admin-answer-state--${answer.validationStatus.toLowerCase()}`}>
          {answer.redacted ? "Conteúdo removido" : answer.isCurrent ? "Vigente" : "Histórica"}
        </span>
      </header>
      {presentation.historicalTextUnavailable ? (
        <p className="admin-detail-caption">Texto histórico indisponível para a versão {answer.questionVersion}.</p>
      ) : null}
      <div className="admin-answer-value">
        <span>Resposta registrada</span>
        <p>{answer.redacted ? "Conteúdo indisponível por proteção de dados." : answer.displayValue ?? (answer.responseType === "SKIPPED" ? "Pergunta pulada" : "Não informado")}</p>
      </div>
      {answer.normalizedFields.length > 0 ? (
        <details className="admin-detail-disclosure">
          <summary>Ver valor estruturado</summary>
          <DefinitionGrid items={answer.normalizedFields.map((field) => ({ label: field.path, value: field.value }))} />
        </details>
      ) : null}
      <DefinitionGrid items={[
        { label: "Tipo", value: answer.responseType },
        { label: "Origem", value: answer.sourceType },
        { label: "Confirmação", value: answer.confirmed ? "Confirmada" : "Não confirmada" },
        { label: "Confiança", value: formatNumber(answer.confidence * 100, "%") },
        { label: "Registrada em", value: formatDateTime(answer.createdAt) },
        { label: "Versão da pergunta", value: answer.questionVersion },
      ]} />
      {history.length > 0 ? (
        <details className="admin-detail-disclosure">
          <summary>Ver {history.length} {history.length === 1 ? "versão anterior" : "versões anteriores"}</summary>
          <div className="admin-answer-history">
            {history.map((item) => (
              <div key={item.id}>
                <strong>Revisão {item.revision}</strong>
                <time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
                <p>{item.redacted ? "Conteúdo indisponível por proteção de dados." : item.displayValue ?? "Não informado"}</p>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </article>
  );
}

function InterviewSection({ data }: Readonly<{ data: InterviewData }>) {
  const { content } = data;
  const currentAnswers = content.answers.filter((answer) => answer.isCurrent);
  const answerHistory = (answer: InterviewAnswer) => content.answers.filter((candidate) => (
    candidate.sessionId === answer.sessionId &&
    candidate.questionCode === answer.questionCode &&
    candidate.id !== answer.id
  )).sort((left, right) => right.revision - left.revision);
  const stageOrder = ["CHALLENGE", "CURRENT_PROCESS", "IMPACT", "BUYING_CONTEXT", "OTHER"];

  return (
    <div className="admin-detail-stack">
      {content.privacyRestricted ? <PrivacyNotice /> : null}
      <section className="admin-detail-panel" aria-labelledby="interview-identification-title">
        <h2 id="interview-identification-title">Identificação</h2>
        <DefinitionGrid items={[
          { label: "Empresa", value: content.identification.companyName ?? "Não informado" },
          { label: "Respondente", value: content.identification.contactName ?? "Não informado" },
          { label: "Cargo ou função", value: content.identification.contactRole ?? "Não informado" },
          { label: "Setor", value: displayLabel(industryLabels, content.identification.industry) },
          { label: "Porte", value: displayLabel(employeeRangeLabels, content.identification.employeeRange) },
        ]} />
      </section>

      <section className="admin-detail-panel" aria-labelledby="interview-sessions-title">
        <h2 id="interview-sessions-title">Sessões da entrevista</h2>
        {content.sessions.length === 0 ? <p>Nenhuma sessão registrada.</p> : (
          <div className="admin-session-list">
            {content.sessions.map((session, index) => (
              <article key={session.id}>
                <strong>Sessão {index + 1}</strong>
                <span>{displayLabel(statusLabels, session.status)}</span>
                <small>Iniciada em {formatDateTime(session.startedAt)} · {session.totalQuestionCount} respostas</small>
              </article>
            ))}
          </div>
        )}
      </section>

      {stageOrder.map((stage) => {
        const stageAnswers = currentAnswers.filter((answer) => questionPresentation(answer).stage === stage);
        if (stageAnswers.length === 0) return null;
        return (
          <section className="admin-detail-panel" key={stage} aria-labelledby={`interview-stage-${stage}`}>
            <h2 id={`interview-stage-${stage}`}>{stageLabels[stage]}</h2>
            <div className="admin-answer-list">
              {stageAnswers.map((answer) => (
                <AnswerCard key={answer.id} answer={answer} history={answerHistory(answer)} />
              ))}
            </div>
          </section>
        );
      })}

      <section className="admin-detail-panel" aria-labelledby="interview-review-title">
        <h2 id="interview-review-title">Revisão apresentada ao visitante</h2>
        {content.review ? (
          <>
            <p className="admin-detail-caption">
              Versão {content.review.version} · {displayLabel(statusLabels, content.review.status)} · gerada em {formatDateTime(content.review.generatedAt)}
            </p>
            <DefinitionGrid items={[
              { label: "Empresa", value: content.review.summary.company ?? "Não informado" },
              { label: "Área afetada", value: content.review.summary.affectedArea ?? "Não informado" },
              { label: "Desafio", value: content.review.summary.challenge ?? "Não informado" },
              { label: "Processo atual", value: content.review.summary.currentProcess ?? "Não informado" },
              { label: "Participantes", value: content.review.summary.participants ?? "Não informado" },
              { label: "Sistemas", value: content.review.summary.systems.join(", ") || "Não informado" },
              { label: "Impactos", value: content.review.summary.mainImpacts.join(", ") || "Não informado" },
              { label: "Resultado desejado", value: content.review.summary.desiredOutcome ?? "Não informado" },
              { label: "Prioridade", value: content.review.summary.priority ?? "Não informado" },
              { label: "Prazo", value: content.review.summary.deadline ?? "Não informado" },
              { label: "Contexto de decisão", value: content.review.summary.decisionContext ?? "Não informado" },
            ]} />
          </>
        ) : <p>Revisão ainda não gerada.</p>}
        {content.reviewHistory.length > 1 ? (
          <details className="admin-detail-disclosure">
            <summary>Histórico de revisões</summary>
            <ul className="admin-detail-version-list">
              {content.reviewHistory.map((review) => (
                <li key={review.id}>
                  <strong>Versão {review.version}</strong>
                  <span>{displayLabel(statusLabels, review.status)}</span>
                  <time dateTime={review.generatedAt}>{formatDateTime(review.generatedAt)}</time>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>
      {content.truncated ? <p className="admin-detail-caption">Há respostas adicionais fora do limite desta visualização.</p> : null}
    </div>
  );
}

function QualificationSection({ data }: Readonly<{ data: QualificationData }>) {
  const { current, history, inconsistentCurrentReference } = data.content;
  if (!current) {
    return <EmptySection
      title={inconsistentCurrentReference ? "Avaliação indisponível" : "Avaliação ainda não gerada"}
      message={inconsistentCurrentReference
        ? "A referência da avaliação vigente está inconsistente e não foi substituída por uma versão histórica."
        : "Este diagnóstico ainda não possui qualificação calculada."}
    />;
  }
  return (
    <div className="admin-detail-stack">
      <section className="admin-detail-panel admin-qualification-summary" aria-labelledby="qualification-summary-title">
        <h2 id="qualification-summary-title">Avaliação vigente</h2>
        <div className="admin-score-display">
          <strong>{current.finalScore ?? "—"}</strong>
          <span>{current.finalScore === null ? "Ainda não calculado" : "pontos"}</span>
        </div>
        <DefinitionGrid items={[
          { label: "Classificação", value: displayLabel(classificationLabels, current.classification) },
          { label: "Confiança", value: current.confidence },
          { label: "Score normalizado", value: formatNumber(current.normalizedScore, " pontos") },
          { label: "Peso avaliado", value: formatNumber(current.assessedWeight, "%") },
          { label: "Cap aplicado", value: current.scoreCapApplied === null ? "Não aplicado" : `${current.scoreCapApplied} pontos` },
          { label: "Rota calculada", value: displayLabel(routeLabels, current.recommendedRoute) },
          { label: "Versão da avaliação", value: current.version },
          { label: "Calculada em", value: formatDateTime(current.calculatedAt) },
        ]} />
      </section>

      <section className="admin-detail-panel" aria-labelledby="qualification-dimensions-title">
        <h2 id="qualification-dimensions-title">Dimensões e critérios</h2>
        <div className="admin-dimension-list">
          {current.dimensions.map((dimension) => (
            <article className="admin-dimension-card" key={dimension.code}>
              <header>
                <div>
                  <span>{dimension.code}</span>
                  <h3>{dimensionLabels[dimension.code] ?? dimension.code}</h3>
                </div>
                <strong>{formatNumber(dimension.earnedPoints)} / {formatNumber(dimension.maxWeight)}</strong>
              </header>
              <p className="admin-detail-caption">Peso avaliado: {formatNumber(dimension.assessedWeight, "%")}</p>
              <div className="admin-criterion-list">
                {dimension.criteria.map((criterion) => (
                  <details key={criterion.code} className="admin-criterion-card">
                    <summary>
                      <span>{criterion.code}</span>
                      <strong>{criterion.assessedWeight === 0 ? "Não avaliado" : `${formatNumber(criterion.earnedPoints)} / ${formatNumber(criterion.maxWeight)}`}</strong>
                    </summary>
                    {criterion.rationale ? <p className="admin-detail-caption">Referência técnica: {criterion.rationale}</p> : null}
                    {criterion.evidence.length === 0 ? <p>Nenhuma evidência vinculada.</p> : (
                      <ul className="admin-evidence-list">
                        {criterion.evidence.map((evidence) => (
                          <li key={evidence.id}>
                            <p>{evidence.text ?? "Conteúdo indisponível por proteção de dados."}</p>
                            <small>{evidence.sourceType} · confiança {formatNumber(evidence.confidence * 100, "%")} · {evidence.confirmed ? "confirmada" : "não confirmada"}</small>
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {history.length > 1 ? (
        <section className="admin-detail-panel" aria-labelledby="qualification-history-title">
          <h2 id="qualification-history-title">Histórico de avaliações</h2>
          <ul className="admin-detail-version-list">
            {history.map((assessment) => (
              <li key={assessment.id} className={assessment.id === current.id ? "is-current" : undefined}>
                <strong>Versão {assessment.version}{assessment.id === current.id ? " · vigente" : ""}</strong>
                <span>{assessment.finalScore === null ? "Sem score" : `${assessment.finalScore} pontos`} · {displayLabel(classificationLabels, assessment.classification)}</span>
                <time dateTime={assessment.calculatedAt}>{formatDateTime(assessment.calculatedAt)}</time>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function FlagList({ title, flags }: Readonly<{
  title: string;
  flags: FlagsData["content"]["active"];
}>) {
  return (
    <section className="admin-detail-panel">
      <h2>{title}</h2>
      {flags.length === 0 ? <p>Nenhuma flag registrada nesta categoria.</p> : (
        <div className="admin-flag-list">
          {flags.map((flag) => (
            <article key={flag.id} className="admin-flag-card">
              <header>
                <div>
                  <span>{flag.code} · {flag.category}</span>
                  <h3>{flag.displayName}</h3>
                </div>
                <span className={`admin-flag admin-flag--${flag.severity.toLowerCase()}`}>{flag.severity}</span>
              </header>
              <p>{flag.reason ?? "Motivo indisponível por proteção de dados."}</p>
              <DefinitionGrid items={[
                { label: "Status", value: displayLabel(statusLabels, flag.status) },
                { label: "Origem", value: flag.source },
                { label: "Efeito no agendamento", value: flag.schedulingEffect },
                { label: "Rota recomendada", value: displayLabel(routeLabels, flag.recommendedRoute) },
                { label: "Pergunta de origem", value: flag.triggerQuestionCode ?? "Não registrada" },
                { label: "Acionada em", value: formatDateTime(flag.triggeredAt) },
                { label: "Resolvida em", value: formatDateTime(flag.resolvedAt) },
                { label: "Condição de resolução", value: flag.resolutionCondition ?? "Não registrada" },
              ]} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function FlagsSection({ data }: Readonly<{ data: FlagsData }>) {
  const { content } = data;
  return (
    <div className="admin-detail-stack">
      {content.privacyRestricted ? <PrivacyNotice /> : null}
      <FlagList title="Flags ativas" flags={content.active} />
      <FlagList title="Flags resolvidas" flags={content.resolved} />
      <section className="admin-detail-panel" aria-labelledby="flag-history-title">
        <h2 id="flag-history-title">Histórico registrado</h2>
        <p className="admin-detail-caption">A timeline contém somente os eventos persistidos e não representa um log completo de todas as alterações de severidade ou motivo.</p>
        {content.history.length === 0 ? <p>Nenhum evento de flag registrado.</p> : (
          <ol className="admin-timeline">
            {content.history.map((event) => (
              <li key={event.id}>
                <time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>
                <strong>{event.flagCode} · {event.eventType}</strong>
                <p>{event.reason ?? `${event.previousStatus ?? "Sem status anterior"} → ${event.newStatus}`}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
      {content.truncated ? <p className="admin-detail-caption">Há registros adicionais fora do limite desta visualização.</p> : null}
    </div>
  );
}

function TextList({ title, items, empty }: Readonly<{
  title: string;
  items: string[];
  empty: string;
}>) {
  return (
    <div className="admin-briefing-list">
      <h3>{title}</h3>
      {items.length === 0 ? <p>{empty}</p> : <ul>{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>}
    </div>
  );
}

function BriefingSection({ data }: Readonly<{ data: BriefingData }>) {
  const { current, history, inconsistentCurrentReference, privacyRestricted } = data.content;
  if (!current) {
    return <EmptySection
      title={inconsistentCurrentReference ? "Briefing indisponível" : "Briefing ainda não gerado"}
      message={inconsistentCurrentReference
        ? "A referência do briefing vigente está inconsistente e não foi substituída por uma versão histórica."
        : "Este diagnóstico ainda não possui briefing comercial."}
    />;
  }
  return (
    <div className="admin-detail-stack">
      {privacyRestricted ? <PrivacyNotice /> : null}
      <section className="admin-detail-panel" aria-labelledby="briefing-title">
        <div className="admin-section-heading">
          <div>
            <h2 id="briefing-title">Briefing vigente</h2>
            <p>Versão {current.version} · {displayLabel(statusLabels, current.status)} · {formatDateTime(current.generatedAt)}</p>
          </div>
          <span className="admin-detail-badge">Origem não registrada</span>
        </div>
        {[
          ["Resumo executivo", current.executiveSummary],
          ["Desafio", current.challengeSummary],
          ["Processo atual", current.currentProcessSummary],
          ["Impacto", current.impactSummary],
          ["Contexto de decisão", current.buyingContextSummary],
          ["Contexto técnico", current.technicalContextSummary],
        ].map(([title, value]) => (
          <div className="admin-detail-prose-block" key={title}>
            <h3>{title}</h3>
            <p>{value ?? "Conteúdo indisponível por proteção de dados."}</p>
          </div>
        ))}
        <div className="admin-briefing-grid">
          <TextList title="Hipóteses iniciais" items={current.initialHypotheses} empty="Nenhuma hipótese registrada." />
          <TextList title="Informações faltantes" items={current.missingInformation} empty="Nenhuma lacuna registrada." />
          <TextList title="Perguntas recomendadas" items={current.recommendedQuestions} empty="Nenhuma pergunta recomendada." />
          <TextList title="Participantes recomendados" items={current.recommendedParticipants} empty="Nenhum participante recomendado." />
        </div>
        <DefinitionGrid items={[
          { label: "Contexto de oferta", value: displayLabel(offerLabels, current.recommendedOffer) },
          { label: "Origem do briefing", value: "Não registrada por artefato" },
        ]} />
      </section>
      {history.length > 1 ? (
        <section className="admin-detail-panel" aria-labelledby="briefing-history-title">
          <h2 id="briefing-history-title">Histórico de briefings</h2>
          <ul className="admin-detail-version-list">
            {history.map((briefing) => (
              <li key={briefing.id} className={briefing.isCurrent ? "is-current" : undefined}>
                <strong>Versão {briefing.version}{briefing.isCurrent ? " · vigente" : ""}</strong>
                <span>{displayLabel(statusLabels, briefing.status)}</span>
                <time dateTime={briefing.generatedAt}>{formatDateTime(briefing.generatedAt)}</time>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

const auditEventLabels: Record<string, string> = {
  DIAGNOSTIC_STARTED: "Diagnóstico iniciado",
  CONSENT_RECORDED: "Consentimento registrado",
  IDENTIFICATION_SAVED: "Identificação salva",
  ANSWER_SAVED: "Resposta registrada",
  REVIEW_GENERATED: "Revisão gerada",
  REVIEW_UPDATED: "Revisão atualizada",
  REVIEW_CONFIRMED: "Revisão confirmada",
  DIAGNOSTIC_COMPLETED: "Diagnóstico concluído",
  DIAGNOSTIC_ABANDONED: "Diagnóstico abandonado",
};

function AuditSection({ data }: Readonly<{ data: AuditData }>) {
  const { events, truncated } = data.content;
  if (events.length === 0) {
    return <EmptySection title="Nenhum evento disponível" message="Ainda não há eventos relevantes registrados para este diagnóstico." />;
  }
  return (
    <section className="admin-detail-panel" aria-labelledby="audit-title">
      <h2 id="audit-title">Histórico relevante</h2>
      <ol className="admin-timeline admin-timeline--audit">
        {events.map((event) => {
          const details = event.eventType === "CONSENT_RECORDED"
            ? [event.consentType, event.decision].filter(Boolean).join(" · ")
            : event.questionCode
              ? `Pergunta ${event.questionCode}`
              : event.version !== null
                ? `Versão ${event.version}`
                : "";
          return (
            <li key={event.id}>
              <time dateTime={event.occurredAt}>{formatDateTime(event.occurredAt)}</time>
              <strong>{auditEventLabels[event.eventType] ?? event.eventType}</strong>
              {details ? <p>{details}</p> : null}
            </li>
          );
        })}
      </ol>
      {truncated ? <p className="admin-detail-caption">Há eventos adicionais fora do limite desta visualização.</p> : null}
    </section>
  );
}

function SectionLoading() {
  return (
    <div className="admin-list-state admin-detail-loading" aria-busy="true">
      <span className="admin-spinner" aria-hidden="true" />
      <p>Carregando diagnóstico…</p>
    </div>
  );
}

function SectionError({ error, onRetry }: Readonly<{
  error: AdminClientError;
  onRetry: () => void;
}>) {
  return (
    <div className="admin-list-state admin-list-state--error" role="alert">
      <h2>{error.code === "NOT_FOUND" ? "Diagnóstico não encontrado." : "Não foi possível carregar este diagnóstico."}</h2>
      <p>{error.message}</p>
      {error.referenceCode ? <small>Código de referência: {error.referenceCode}</small> : null}
      {error.code !== "NOT_FOUND" ? (
        <button className="admin-primary-button" type="button" onClick={onRetry}>Tentar novamente</button>
      ) : null}
    </div>
  );
}

function AdminDiagnosticDetailView({ diagnosticId }: Readonly<{ diagnosticId: string | null }>) {
  const { refresh } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<AdminDiagnosticTab>("visao-geral");
  const [dataBySection, setDataBySection] = useState<DetailDataBySection>({});
  const [loadingBySection, setLoadingBySection] = useState<Partial<Record<AdminDiagnosticDetailSection, boolean>>>({});
  const [errorsBySection, setErrorsBySection] = useState<Partial<Record<AdminDiagnosticDetailSection, AdminClientError>>>({});
  const [retryKey, setRetryKey] = useState(0);
  const dataRef = useRef<DetailDataBySection>({});
  const pendingRef = useRef(new Map<AdminDiagnosticDetailSection, AbortController>());
  const tabRefs = useRef(new Map<AdminDiagnosticTab, HTMLAnchorElement>());

  const activeSection = tabs.find((tab) => tab.id === activeTab)?.section ?? "OVERVIEW";

  useEffect(() => {
    const syncTab = () => {
      const candidate = window.location.hash.slice(1);
      setActiveTab(isDiagnosticTab(candidate) ? candidate : "visao-geral");
    };
    syncTab();
    window.addEventListener("hashchange", syncTab);
    return () => window.removeEventListener("hashchange", syncTab);
  }, []);

  useEffect(() => {
    if (!diagnosticId) return;
    const requested = new Set<AdminDiagnosticDetailSection>(["OVERVIEW", activeSection]);
    const started: AbortController[] = [];

    requested.forEach((section) => {
      if (dataRef.current[section] || pendingRef.current.has(section)) return;
      const controller = new AbortController();
      started.push(controller);
      pendingRef.current.set(section, controller);
      setLoadingBySection((current) => ({ ...current, [section]: true }));
      setErrorsBySection((current) => ({ ...current, [section]: undefined }));

      void getAdminDiagnosticDetail({ diagnosticId, section }, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          dataRef.current = { ...dataRef.current, [section]: result };
          setDataBySection(dataRef.current);
        })
        .catch((caught: unknown) => {
          if (controller.signal.aborted) return;
          const error = caught instanceof AdminClientError
            ? caught
            : new AdminClientError("GENERIC_ERROR", "Não foi possível carregar este diagnóstico.");
          if (error.code === "UNAUTHORIZED" || error.code === "ACCESS_DENIED") {
            void refresh();
            return;
          }
          setErrorsBySection((current) => ({ ...current, [section]: error }));
        })
        .finally(() => {
          if (pendingRef.current.get(section) === controller) pendingRef.current.delete(section);
          if (!controller.signal.aborted) {
            setLoadingBySection((current) => ({ ...current, [section]: false }));
          }
        });
    });

    return () => {
      started.forEach((controller) => controller.abort());
    };
  }, [activeSection, diagnosticId, refresh, retryKey]);

  const overview = dataBySection.OVERVIEW?.section === "OVERVIEW"
    ? dataBySection.OVERVIEW
    : null;
  const activeData = dataBySection[activeSection];
  const activeError = errorsBySection[activeSection];
  const overviewError = errorsBySection.OVERVIEW;
  const meta = overview?.meta ?? activeData?.meta ?? null;

  const headerTitle = meta?.companyName ?? "Empresa não informada";
  const headerFacts = useMemo(() => meta ? [
    displayLabel(statusLabels, meta.diagnosticStatus),
    meta.finalScore === null ? "Sem score" : `${meta.finalScore} pontos`,
    displayLabel(classificationLabels, meta.classification),
    meta.contactAllowed ? "Contato autorizado" : "Contato não autorizado",
  ] : [], [meta]);

  function retry(section: AdminDiagnosticDetailSection) {
    pendingRef.current.get(section)?.abort();
    pendingRef.current.delete(section);
    delete dataRef.current[section];
    setDataBySection({ ...dataRef.current });
    setErrorsBySection((current) => ({ ...current, [section]: undefined }));
    setRetryKey((value) => value + 1);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = ADMIN_DIAGNOSTIC_TABS.indexOf(activeTab);
    let target = index;
    if (event.key === "ArrowRight") target = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") target = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = tabs.length - 1;
    else return;
    event.preventDefault();
    tabRefs.current.get(tabs[target].id)?.focus();
  }

  if (!diagnosticId) {
    return (
      <section className="admin-page">
        <nav className="admin-breadcrumb" aria-label="Breadcrumb">
          <a href={withBasePath("/adm/")}>ADM</a><span aria-hidden="true">/</span>
          <a href={withBasePath("/adm/diagnosticos/")}>Diagnósticos</a><span aria-hidden="true">/</span>
          <span aria-current="page">Detalhe</span>
        </nav>
        <SectionError
          error={new AdminClientError("NOT_FOUND", "O endereço do diagnóstico é inválido ou está incompleto.")}
          onRetry={() => undefined}
        />
      </section>
    );
  }

  if (!meta && overviewError) {
    return (
      <section className="admin-page">
        <nav className="admin-breadcrumb" aria-label="Breadcrumb">
          <a href={withBasePath("/adm/")}>ADM</a><span aria-hidden="true">/</span>
          <a href={withBasePath("/adm/diagnosticos/")}>Diagnósticos</a><span aria-hidden="true">/</span>
          <span aria-current="page">Detalhe</span>
        </nav>
        <SectionError error={overviewError} onRetry={() => retry("OVERVIEW")} />
      </section>
    );
  }

  return (
    <section className="admin-page admin-diagnostic-detail" aria-labelledby="admin-detail-title">
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <a href={withBasePath("/adm/")}>ADM</a><span aria-hidden="true">/</span>
        <a href={withBasePath("/adm/diagnosticos/")}>Diagnósticos</a><span aria-hidden="true">/</span>
        <span aria-current="page">Detalhe</span>
      </nav>

      {!meta ? <SectionLoading /> : (
        <>
          <header className="admin-detail-header">
            <a className="admin-detail-back" href={withBasePath("/adm/diagnosticos/")}>← Voltar para diagnósticos</a>
            <p className="admin-eyebrow">Análise do diagnóstico</p>
            <h1 id="admin-detail-title">{headerTitle}</h1>
            <div className="admin-detail-header__facts">
              {headerFacts.map((fact, index) => (
                <span key={`${index}-${fact}`} className={index === 3
                  ? `admin-contact-state admin-contact-state--${meta.contactAllowed ? "allowed" : "denied"}`
                  : undefined}
                >{fact}</span>
              ))}
              <time dateTime={meta.createdAt}>Criado em {formatDateTime(meta.createdAt)}</time>
            </div>
          </header>

          <div className="admin-detail-tabs-wrap">
            <div className="admin-detail-tabs" role="tablist" aria-label="Seções do diagnóstico" onKeyDown={handleTabKeyDown}>
              {tabs.map((tab) => (
                <a
                  key={tab.id}
                  ref={(node) => {
                    if (node) tabRefs.current.set(tab.id, node);
                    else tabRefs.current.delete(tab.id);
                  }}
                  id={`admin-tab-${tab.id}`}
                  href={`#${tab.id}`}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`admin-panel-${tab.id}`}
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                >{tab.label}</a>
              ))}
            </div>
          </div>

          <div
            id={`admin-panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`admin-tab-${activeTab}`}
            className="admin-detail-tabpanel"
          >
            {loadingBySection[activeSection] && !activeData ? <SectionLoading />
              : activeError ? <SectionError error={activeError} onRetry={() => retry(activeSection)} />
                : activeData?.section === "OVERVIEW" ? <OverviewSection data={activeData} />
                  : activeData?.section === "INTERVIEW" ? <InterviewSection data={activeData} />
                    : activeData?.section === "QUALIFICATION" ? <QualificationSection data={activeData} />
                      : activeData?.section === "FLAGS" ? <FlagsSection data={activeData} />
                        : activeData?.section === "BRIEFING" ? <BriefingSection data={activeData} />
                          : activeData?.section === "AUDIT" ? <AuditSection data={activeData} />
                            : <SectionLoading />}
          </div>
        </>
      )}
    </section>
  );
}

export function AdminDiagnosticDetail() {
  const searchParams = useSearchParams();
  const { session } = useAdminAuth();
  const idValues = searchParams.getAll("id");
  const diagnosticId = idValues.length === 1 && isDiagnosticId(idValues[0]) ? idValues[0] : null;
  const viewKey = `${session?.userId ?? "anonymous"}:${diagnosticId ?? "invalid"}`;
  return <AdminDiagnosticDetailView key={viewKey} diagnosticId={diagnosticId} />;
}
