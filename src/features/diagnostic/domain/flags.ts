import { isTemporaryEmailAddress } from "../contracts";
import type {
  DiagnosticFlag,
  DiagnosticFlagCode,
  DiagnosticSignal,
  DiagnosticState,
  FlagSeverity,
  QualificationAssessment,
} from "./types";
import { normalizeText } from "./value-utils";

export type FlagEvaluationInput = {
  readonly state: DiagnosticState;
  readonly assessment?: QualificationAssessment;
};

const personalEmailDomains = new Set([
  "bol.com.br",
  "gmail.com",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "outlook.com",
  "proton.me",
  "protonmail.com",
  "uol.com.br",
  "yahoo.com",
  "yahoo.com.br",
]);

const consentCodes = new Set<DiagnosticFlagCode>([
  "PRIVACY_NOT_ACCEPTED",
  "COMMERCIAL_CONTACT_NOT_ACCEPTED",
  "CONSENT_VERSION_MISSING",
]);
const fitCodes = new Set<DiagnosticFlagCode>([
  "TOOL_ONLY_REQUEST",
  "AUTOMATION_ONLY_EXPECTATION",
  "LOW_METHODOLOGY_FIT",
  "STAFF_AUGMENTATION_EXPECTATION",
  "FREE_WORK_EXPECTATION",
  "FREE_WORK_REQUIREMENT",
  "COMPLETELY_OUT_OF_SCOPE",
  "LOW_OPERATIONAL_COMPLEXITY",
  "RESEARCH_ONLY",
]);
const maturityCodes = new Set<DiagnosticFlagCode>([
  "NO_INTERNAL_OWNER",
  "OWNER_UNDEFINED",
  "DECISION_PROCESS_UNDEFINED",
  "NO_EXECUTIVE_SPONSOR",
  "BUDGET_UNDEFINED",
  "BUDGET_REJECTED",
  "LOW_URGENCY",
  "DEADLINE_INCONSISTENT",
]);
const technicalCodes = new Set<DiagnosticFlagCode>([
  "LIMITED_DATA",
  "DATA_FRAGMENTED",
  "NO_DATA_AVAILABLE",
  "SYSTEMS_NOT_IDENTIFIED",
  "INTEGRATION_FEASIBILITY_UNKNOWN",
  "NO_IT_AVAILABILITY",
  "IT_AVAILABILITY_UNKNOWN",
  "LEGACY_SYSTEM_DEPENDENCY",
  "MANUAL_PROCESS_WITHOUT_RECORDS",
]);
const complexityCodes = new Set<DiagnosticFlagCode>([
  "STRATEGIC_ENTERPRISE",
  "MULTI_AREA_TRANSFORMATION",
  "HIGH_REGULATORY_RISK",
  "SECURITY_RELEVANT_PROJECT",
  "UNUSUAL_TECHNICAL_COMPLEXITY",
  "CRITICAL_OPERATION",
  "HIGH_EXPECTED_IMPACT",
]);
const securityCodes = new Set<DiagnosticFlagCode>([
  "SENSITIVE_DATA_SHARED",
  "SEVERE_SENSITIVE_DATA_EXPOSURE",
  "PROMPT_INJECTION_ATTEMPT",
  "PERSISTENT_PROMPT_INJECTION",
  "PERSISTENT_ABUSE",
  "SPAM_OR_BOT",
  "FRAUD_SUSPECTED",
  "ILLEGAL_REQUEST",
  "IDENTITY_EVIDENTLY_FALSE",
]);

function categoryFor(code: DiagnosticFlagCode): DiagnosticFlag["category"] {
  if (consentCodes.has(code)) return "CONSENT";
  if (fitCodes.has(code)) return "FIT";
  if (maturityCodes.has(code)) return "MATURITY";
  if (technicalCodes.has(code)) return "TECHNICAL";
  if (complexityCodes.has(code)) return "COMPLEXITY";
  if (securityCodes.has(code)) return "SECURITY";
  if (
    code === "AI_EXTRACTION_FAILURE" ||
    code === "AI_PROVIDER_UNAVAILABLE" ||
    code === "DATABASE_PERSISTENCE_FAILURE"
  ) {
    return "SYSTEM";
  }
  return "DATA";
}

function severityFor(code: DiagnosticFlagCode): FlagSeverity {
  if (
    [
      "PRIVACY_NOT_ACCEPTED",
      "TEMPORARY_EMAIL",
      "SEVERE_SENSITIVE_DATA_EXPOSURE",
      "PERSISTENT_PROMPT_INJECTION",
      "PERSISTENT_ABUSE",
      "FRAUD_SUSPECTED",
      "ILLEGAL_REQUEST",
    ].includes(code)
  ) {
    return "S3";
  }

  if (
    [
      "CONSENT_VERSION_MISSING",
      "CONTRADICTORY_INFORMATION",
      "INSUFFICIENT_INFORMATION",
      "HIGH_IMPACT_LOW_INFORMATION",
      "COMPLETELY_OUT_OF_SCOPE",
      "IDENTITY_EVIDENTLY_FALSE",
      "DATABASE_PERSISTENCE_FAILURE",
    ].includes(code)
  ) {
    return "S2";
  }

  if (
    [
      "COMMERCIAL_CONTACT_NOT_ACCEPTED",
      "PERSONAL_EMAIL",
      "PHONE_NOT_PROVIDED",
      "STRATEGIC_ENTERPRISE",
      "MULTI_AREA_TRANSFORMATION",
    ].includes(code)
  ) {
    return "S0";
  }

  return "S1";
}

function createFlag(code: DiagnosticFlagCode, reason: string): DiagnosticFlag {
  const severity = severityFor(code);
  return {
    code,
    displayName: code
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
    category: categoryFor(code),
    severity,
    reason,
    schedulingEffect:
      severity === "S3"
        ? "BLOCK_ALL"
        : severity === "S2"
          ? "BLOCK_AUTOMATIC"
          : "NONE",
  };
}

function domainOf(email: string | undefined): string | undefined {
  return email?.trim().toLowerCase().split("@").at(1);
}

const directSignalFlags: Partial<
  Readonly<Record<DiagnosticSignal, DiagnosticFlagCode>>
> = {
  TOOL_ONLY_REQUEST: "TOOL_ONLY_REQUEST",
  AUTOMATION_ONLY_EXPECTATION: "AUTOMATION_ONLY_EXPECTATION",
  STAFF_AUGMENTATION_EXPECTATION: "STAFF_AUGMENTATION_EXPECTATION",
  FREE_WORK_EXPECTATION: "FREE_WORK_EXPECTATION",
  FREE_WORK_REQUIREMENT: "FREE_WORK_REQUIREMENT",
  COMPLETELY_OUT_OF_SCOPE: "COMPLETELY_OUT_OF_SCOPE",
  RESEARCH_ONLY: "RESEARCH_ONLY",
  CONTRADICTORY_INFORMATION: "CONTRADICTORY_INFORMATION",
  SENSITIVE_DATA_SHARED: "SENSITIVE_DATA_SHARED",
  SEVERE_SENSITIVE_DATA_EXPOSURE: "SEVERE_SENSITIVE_DATA_EXPOSURE",
  PROMPT_INJECTION_ATTEMPT: "PROMPT_INJECTION_ATTEMPT",
  PERSISTENT_PROMPT_INJECTION: "PERSISTENT_PROMPT_INJECTION",
  PERSISTENT_ABUSE: "PERSISTENT_ABUSE",
  SPAM_OR_BOT: "SPAM_OR_BOT",
  FRAUD_SUSPECTED: "FRAUD_SUSPECTED",
  ILLEGAL_REQUEST: "ILLEGAL_REQUEST",
  IDENTITY_EVIDENTLY_FALSE: "IDENTITY_EVIDENTLY_FALSE",
  AI_EXTRACTION_FAILURE: "AI_EXTRACTION_FAILURE",
  AI_PROVIDER_UNAVAILABLE: "AI_PROVIDER_UNAVAILABLE",
  DATABASE_PERSISTENCE_FAILURE: "DATABASE_PERSISTENCE_FAILURE",
};

export function evaluateFlags(input: FlagEvaluationInput): readonly DiagnosticFlag[] {
  const { state, assessment } = input;
  const data = state.structuredData;
  const flags = new Map<DiagnosticFlagCode, DiagnosticFlag>();
  const add = (code: DiagnosticFlagCode, reason: string): void => {
    if (!flags.has(code)) flags.set(code, createFlag(code, reason));
  };

  if (state.privacyConsent === false) {
    add("PRIVACY_NOT_ACCEPTED", "O consentimento de privacidade não foi aceito.");
  }
  if (state.commercialConsent === false) {
    add(
      "COMMERCIAL_CONTACT_NOT_ACCEPTED",
      "O contato comercial não foi autorizado; a entrevista pode continuar.",
    );
  }
  if (
    (state.privacyConsent !== null && !state.privacyConsentVersion) ||
    (state.commercialConsent !== null && !state.commercialConsentVersion)
  ) {
    add("CONSENT_VERSION_MISSING", "Há consentimento sem versão registrada.");
  }

  const emailDomain = domainOf(data.lead.email);
  if (emailDomain && personalEmailDomains.has(emailDomain)) {
    add("PERSONAL_EMAIL", "Foi informado um domínio de e-mail pessoal permitido.");
  }
  if (data.lead.email && isTemporaryEmailAddress(data.lead.email)) {
    add("TEMPORARY_EMAIL", "Foi detectado um domínio de e-mail temporário.");
  }
  if (!data.lead.phone) {
    add("PHONE_NOT_PROVIDED", "Telefone profissional opcional não informado.");
  }

  if (!data.challenge.summary || data.challenge.summary.trim().length < 20) {
    add("PROBLEM_UNCLEAR", "O desafio ainda não possui descrição suficientemente clara.");
  }
  if (state.answers.some((answer) => answer.clarity === "VAGUE")) {
    add("LOW_RESPONSE_CONFIDENCE", "Ao menos uma resposta permanece vaga.");
  }
  if (!state.reviewConfirmed && ["REVIEW_PENDING", "COMPLETING"].includes(state.status)) {
    add("REVIEW_NOT_CONFIRMED", "O resumo ainda não foi confirmado pelo visitante.");
  }
  if (assessment?.assessmentConfidence === "INSUFFICIENT") {
    add("INSUFFICIENT_INFORMATION", "O peso avaliado está abaixo do mínimo de 50.");
  }

  const impactCategories = data.impact.categories ?? [];
  const highImpact = impactCategories.some((category) =>
    [
      "HIGH_OPERATIONAL_COST",
      "REVENUE_LOSS",
      "REGULATORY_RISK",
      "QUALITY_RISK",
    ].includes(category),
  );
  if (highImpact && assessment?.assessmentConfidence === "INSUFFICIENT") {
    add(
      "HIGH_IMPACT_LOW_INFORMATION",
      "Há impacto relevante reportado, mas informação insuficiente para avaliação.",
    );
  }

  if (data.buyingContext.processRedesignOpenness === "AUTOMATION_ONLY") {
    add("AUTOMATION_ONLY_EXPECTATION", "Foi declarada expectativa restrita à automação.");
    add("LOW_METHODOLOGY_FIT", "A abertura para redesenho de processo é baixa.");
  }
  if (data.lead.employeeRange === "UP_TO_10" && (data.currentProcess.systems?.length ?? 0) <= 1) {
    add("LOW_OPERATIONAL_COMPLEXITY", "O contexto indica baixa complexidade operacional.");
  }

  if (data.buyingContext.internalOwnerExists === false) {
    add("NO_INTERNAL_OWNER", "Não existe responsável interno para a iniciativa.");
  } else if (
    data.buyingContext.internalOwnerExists === true &&
    !data.buyingContext.internalOwnerArea
  ) {
    add("OWNER_UNDEFINED", "Existe responsável, mas sua área ou função não foi definida.");
  }
  if (
    !data.buyingContext.decisionMakers ||
    data.buyingContext.decisionMakers.includes("UNDEFINED")
  ) {
    add("DECISION_PROCESS_UNDEFINED", "O processo decisório ainda não está definido.");
  } else if (
    !data.buyingContext.decisionMakers.some((maker) =>
      ["EXECUTIVE_BOARD", "PARTNERS"].includes(maker),
    )
  ) {
    add("NO_EXECUTIVE_SPONSOR", "Patrocínio executivo não foi identificado.");
  }
  if (
    !data.buyingContext.budgetStatus ||
    ["UNKNOWN", "PREFER_NOT_TO_SAY"].includes(data.buyingContext.budgetStatus)
  ) {
    add("BUDGET_UNDEFINED", "O contexto de investimento permanece indefinido.");
  }
  if (data.buyingContext.budgetStatus === "REJECTED") {
    add("BUDGET_REJECTED", "O investimento foi reportado como rejeitado.");
  }
  if ((data.buyingContext.priority ?? 0) <= 2) {
    add("LOW_URGENCY", "A prioridade declarada é baixa ou exploratória.");
  }

  if (data.technicalContext.dataAvailability === "AVAILABLE_FRAGMENTED") {
    add("DATA_FRAGMENTED", "Os dados foram reportados como fragmentados.");
  }
  if (data.technicalContext.dataAvailability === "PARTIAL") {
    add("LIMITED_DATA", "Os dados foram reportados como parcialmente disponíveis.");
  }
  if (data.technicalContext.dataAvailability === "PRACTICALLY_UNAVAILABLE") {
    add("NO_DATA_AVAILABLE", "Os dados foram reportados como praticamente indisponíveis.");
  }
  if (!data.currentProcess.systems || data.currentProcess.systems.length === 0) {
    add("SYSTEMS_NOT_IDENTIFIED", "Os sistemas envolvidos ainda não foram identificados.");
  }
  if (
    (data.currentProcess.systems?.length ?? 0) >= 2 &&
    data.technicalContext.integrationLikely === undefined
  ) {
    add(
      "INTEGRATION_FEASIBILITY_UNKNOWN",
      "Há múltiplos sistemas e a viabilidade de integração ainda não foi avaliada.",
    );
  }
  if (
    ["NO_INTERNAL_TEAM", "UNAVAILABLE"].includes(
      data.technicalContext.itAvailability ?? "",
    )
  ) {
    add("NO_IT_AVAILABILITY", "Disponibilidade técnica interna não confirmada.");
  } else if (
    !data.technicalContext.itAvailability ||
    data.technicalContext.itAvailability === "UNKNOWN"
  ) {
    add("IT_AVAILABILITY_UNKNOWN", "Disponibilidade da equipe técnica é desconhecida.");
  }
  if (
    state.signals.includes("MANUAL_PROCESS") &&
    data.technicalContext.dataAvailability === "PRACTICALLY_UNAVAILABLE"
  ) {
    add("MANUAL_PROCESS_WITHOUT_RECORDS", "Processo manual sem registros disponíveis.");
  }

  if (data.lead.employeeRange === "ABOVE_1000") {
    add("STRATEGIC_ENTERPRISE", "O porte reportado indica contexto empresarial estratégico.");
  }
  if ((data.currentProcess.involvedAreas?.length ?? 0) >= 3) {
    add("MULTI_AREA_TRANSFORMATION", "O processo envolve três ou mais áreas.");
  }
  if (impactCategories.includes("REGULATORY_RISK")) {
    add("HIGH_REGULATORY_RISK", "Foi reportado impacto de natureza regulatória.");
  }
  if (
    highImpact ||
    ["200K_1M_YEAR", "ABOVE_1M_YEAR"].includes(
      data.impact.reportedFinancialImpact ?? "",
    )
  ) {
    add("HIGH_EXPECTED_IMPACT", "O impacto reportado exige avaliação especializada.");
  }
  const riskText = normalizeText(data.impact.riskOfInaction ?? "");
  if (/paralisa|critica|interrupcao|indisponibilidade/.test(riskText)) {
    add("CRITICAL_OPERATION", "O risco de não agir indica possível operação crítica.");
  }

  for (const signal of state.signals) {
    const code = directSignalFlags[signal];
    if (code) add(code, `Sinal determinístico registrado: ${signal}.`);
  }

  return [...flags.values()];
}
