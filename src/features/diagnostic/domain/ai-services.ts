import {
  ClarificationSuggestionSchema,
  ClarityResultSchema,
  ExtractAnswerResultSchema,
  GeneratedBriefingSchema,
  GeneratedReviewSchema,
  type ClarityResult,
  type EvaluateClarityInput,
  type ExtractAnswerInput,
  type ExtractAnswerResult,
  type ExtractedField,
  type GenerateBriefingInput,
  type GeneratedBriefing,
  type GeneratedReview,
  type GenerateReviewInput,
  type InterviewAIOperation,
  type InterviewAIService,
  type SuggestClarificationInput,
  type ClarificationSuggestion,
} from "../contracts";
import { validateAnswer } from "./answer-validation";
import { redactSensitiveData } from "./security";
import { PROBLEM_AREAS, type ProblemArea } from "./types";
import { answerAsText, normalizeText } from "./value-utils";

export const AI_PROMPT_VERSION = "1.0.0";
export const AI_SYSTEM_INSTRUCTION = `Você é um componente auxiliar de extração e redação.
Você não conduz a entrevista.
Você não toma decisões comerciais.
Você não define score.
Você não inventa fatos.
Você não transforma inferência em fato.
Você retorna somente JSON conforme o schema fornecido.`;

const asText = (value: unknown, fallback = "Não informado"): string => {
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const values = value.filter((item): item is string => typeof item === "string");
    return values.join(", ") || fallback;
  }
  if (value && typeof value === "object") {
    if ("unknown" in value && value.unknown === true) return fallback;
    if ("value" in value && "unit" in value) {
      return `${String(value.value)} ${String(value.unit)}`;
    }
  }
  return fallback;
};
const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

type SemanticField = Pick<
  ExtractedField,
  "value" | "sourceType" | "confidence"
>;

const problemAreaSet = new Set<string>(PROBLEM_AREAS);

const areaMatchers: readonly {
  readonly area: ProblemArea;
  readonly patterns: readonly RegExp[];
}[] = [
  {
    area: "COMMERCIAL",
    patterns: [
      /\b(?:area\s+(?:comercial|de\s+vendas)|comercial|vendas?|sales)\b/,
    ],
  },
  {
    area: "FINANCE",
    patterns: [
      /\b(?:area\s+(?:financeira|de\s+financas)|financeir[oa]s?|financas?|contabilidade|contabil|fiscal|tesouraria)\b/,
      /\b(?:contas?\s+a\s+(?:pagar|receber)|faturamento|conciliacao\s+(?:bancaria|financeira|contabil))\b/,
    ],
  },
  {
    area: "CUSTOMER_SERVICE",
    patterns: [
      /\b(?:atendimento(?:\s+ao\s+cliente)?|suporte\s+ao\s+cliente|sac|customer\s+(?:service|success)|sucesso\s+do\s+cliente)\b/,
    ],
  },
  {
    area: "OPERATIONS_LOGISTICS",
    patterns: [
      /\b(?:area\s+operacional|operacoes|logistica|expedicao|producao)\b/,
    ],
  },
  {
    area: "PROCUREMENT",
    patterns: [
      /\b(?:area\s+de\s+compras|compras|suprimentos|procurement|aquisicoes)\b/,
    ],
  },
  {
    area: "HUMAN_RESOURCES",
    patterns: [
      /\b(?:recursos\s+humanos|rh|departamento\s+pessoal|gestao\s+de\s+pessoas|pessoas\s+e\s+cultura)\b/,
    ],
  },
  {
    area: "LEGAL",
    patterns: [
      /\b(?:area\s+(?:juridica|legal)|departamento\s+(?:juridico|legal)|juridic[oa])\b/,
    ],
  },
  {
    area: "TECHNOLOGY",
    patterns: [
      /\b(?:tecnologia\s+da\s+informacao|area\s+de\s+tecnologia|equipe\s+de\s+tecnologia|departamento\s+de\s+tecnologia|infraestrutura\s+de\s+tecnologia|ti)\b/,
      /\btecnologia\b(?=\s*[:,-])/,
    ],
  },
  {
    area: "OTHER",
    patterns: [/\b(?:outra\s+area|area\s+nao\s+listada)\b/],
  },
];

const symptomMatchers: readonly {
  readonly label: string;
  readonly pattern: RegExp;
}[] = [
  { label: "Retrabalho", pattern: /\bretrabalho\b/ },
  { label: "Atrasos", pattern: /\batrasos?\b/ },
  { label: "Erros", pattern: /\berros?\b/ },
  { label: "Falhas", pattern: /\bfalhas?\b/ },
  { label: "Perda de tempo", pattern: /\bperda\s+de\s+tempo\b/ },
  { label: "Lentidao", pattern: /\b(?:lentidao|demora)\b/ },
  { label: "Trabalho manual", pattern: /\b(?:trabalho|processo)\s+manual\b/ },
  { label: "Redigitacao", pattern: /\b(?:redigitacao|redigitar|digitacao\s+duplicada)\b/ },
  { label: "Gargalo", pattern: /\bgargalos?\b/ },
  { label: "Falta de visibilidade", pattern: /\bfalta\s+de\s+visibilidade\b/ },
];

function findProblemAreas(answer: unknown, text: string): readonly ProblemArea[] {
  if (Array.isArray(answer)) {
    const selected = answer.filter(
      (value): value is ProblemArea =>
        typeof value === "string" && problemAreaSet.has(value),
    );
    return [...new Set(selected)];
  }

  if (typeof answer === "string" && problemAreaSet.has(answer)) {
    return [answer as ProblemArea];
  }

  const normalized = normalizeText(text);
  const matches = areaMatchers.flatMap(({ area, patterns }) => {
    const indexes = patterns
      .map((pattern) => normalized.search(pattern))
      .filter((index) => index >= 0);
    return indexes.length === 0
      ? []
      : [{ area, index: Math.min(...indexes) }];
  });

  matches.sort((left, right) => left.index - right.index);
  return matches.map(({ area }) => area);
}

function extractReportedProcess(text: string): string | undefined {
  const normalized = normalizeText(text);
  const match = /\b(?:processo|fluxo|rotina|atividade)\s+(?:(?:de|do|da|dos|das)\s+)?(.{2,160}?)(?=\s+(?:(?:e\s+)?(?:gera|causa|provoca|resulta|tem\s+gerado|esta\s+gerando))\b|[.;:\n]|$)/
    .exec(normalized);
  if (!match?.[1] || match.index === undefined) return undefined;

  const relativeStart = match[0].indexOf(match[1]);
  const start = match.index + relativeStart;
  const value = text.slice(start, start + match[1].length).trim();
  return value.length >= 2 ? value : undefined;
}

function extractSymptoms(text: string): readonly string[] {
  const normalized = normalizeText(text);
  return symptomMatchers
    .filter(({ pattern }) => pattern.test(normalized))
    .map(({ label }) => label);
}

const participantNumberWords: Readonly<Record<string, number>> = {
  uma: 1,
  um: 1,
  duas: 2,
  dois: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
};

function extractParticipantCount(text: string): number | undefined {
  const normalized = normalizeText(text);
  const participantNoun =
    "(?:pessoas?|colaboradores?|participantes?|usuarios?|funcionarios?|profissionais?)";
  const numeric = new RegExp(`\\b(\\d{1,6})\\s+${participantNoun}\\b`).exec(normalized) ??
    new RegExp(`\\b(?:equipe|time)\\s+(?:de|com)\\s+(\\d{1,6})\\b`).exec(normalized);
  if (numeric?.[1]) return Number(numeric[1]);

  const words = Object.keys(participantNumberWords).join("|");
  const written = new RegExp(`\\b(${words})\\s+${participantNoun}\\b`).exec(normalized) ??
    new RegExp(`\\b(?:equipe|time)\\s+(?:de|com)\\s+(${words})\\b`).exec(normalized);
  return written?.[1] ? participantNumberWords[written[1]] : undefined;
}

function semanticFieldForPath(
  path: string,
  answer: unknown,
  safeText: string,
  areas: readonly ProblemArea[],
  clarity: ClarityResult,
): SemanticField | undefined {
  const reportedConfidence = clarity.level === "CLEAR" ? 0.95 : 0.55;

  switch (path) {
    case "challenge.summary":
      return typeof answer === "string"
        ? { value: safeText, sourceType: "REPORTED_FACT", confidence: reportedConfidence }
        : undefined;
    case "challenge.affectedAreas":
      return areas.length > 0
        ? { value: areas, sourceType: "REPORTED_FACT", confidence: 0.9 }
        : undefined;
    case "challenge.primaryAffectedArea":
      return areas[0]
        ? { value: areas[0], sourceType: "REPORTED_FACT", confidence: 0.9 }
        : undefined;
    case "challenge.process": {
      if (typeof answer !== "string") return undefined;
      const process = extractReportedProcess(safeText);
      return process
        ? { value: process, sourceType: "REPORTED_FACT", confidence: 0.9 }
        : undefined;
    }
    case "challenge.symptoms": {
      if (typeof answer !== "string") return undefined;
      const symptoms = extractSymptoms(safeText);
      return symptoms.length > 0
        ? { value: symptoms, sourceType: "REPORTED_FACT", confidence: 0.9 }
        : undefined;
    }
    case "currentProcess.participants":
      return typeof answer === "string"
        ? { value: safeText, sourceType: "REPORTED_FACT", confidence: reportedConfidence }
        : undefined;
    case "currentProcess.participantCount": {
      if (typeof answer !== "string") return undefined;
      const participantCount = extractParticipantCount(safeText);
      return participantCount === undefined
        ? undefined
        : { value: participantCount, sourceType: "REPORTED_FACT", confidence: 0.95 };
    }
    case "currentProcess.involvedAreas":
      return areas.length > 0
        ? { value: areas, sourceType: "REPORTED_FACT", confidence: 0.9 }
        : undefined;
    default:
      return undefined;
  }
}

function clarityFor(input: EvaluateClarityInput): ClarityResult {
  const isTextQuestion = input.question.responseType === "SHORT_TEXT" ||
    input.question.responseType === "LONG_TEXT";
  if (isTextQuestion && typeof input.answer !== "string") {
    return {
      level: "VAGUE",
      confidence: 0.95,
      missingAspects: ["resposta em texto"],
      shouldClarify: true,
    };
  }
  if (!isTextQuestion) {
    try {
      validateAnswer(input.question, input.answer);
      return {
        level: "CLEAR",
        confidence: 1,
        missingAspects: [],
        shouldClarify: false,
      };
    } catch {
      return {
        level: "VAGUE",
        confidence: 0.95,
        missingAspects: ["resposta válida"],
        shouldClarify: true,
      };
    }
  }

  const text = answerAsText(input.answer).trim();
  const minimum = input.question.validation?.minLength ?? 8;
  const normalized = normalizeText(text);
  const vague = /^(nao sei|talvez|algo|isso|automatizar|ia|sim|nao)[.!]?$/i.test(normalized);
  const level = vague || text.length < Math.min(minimum, 12)
    ? "VAGUE"
    : text.length < minimum
      ? "PARTIAL"
      : "CLEAR";
  return {
    level,
    confidence: level === "CLEAR" ? 0.95 : level === "PARTIAL" ? 0.75 : 0.9,
    missingAspects: level === "CLEAR" ? [] : ["exemplo concreto"],
    shouldClarify: level !== "CLEAR",
  };
}

export class DeterministicInterviewAIService implements InterviewAIService {
  async extractAnswer(input: ExtractAnswerInput): Promise<ExtractAnswerResult> {
    validateAnswer(input.question, input.answer);
    const renderedAnswer = asText(input.answer);
    const redaction = redactSensitiveData(renderedAnswer);
    const clarity = clarityFor({ question: input.question, answer: input.answer });
    const safeValue = typeof input.answer === "string" ? redaction.redactedText : input.answer;
    const targetPaths = [...new Set(input.targetPaths)];
    const isUnknown = !Array.isArray(input.answer) &&
      typeof input.answer === "object" &&
      input.answer !== null &&
      "unknown" in input.answer &&
      input.answer.unknown === true;
    const isEstimate = typeof input.answer === "number" ||
      (!Array.isArray(input.answer) &&
        typeof input.answer === "object" &&
        input.answer !== null &&
        "value" in input.answer &&
        "unit" in input.answer);
    const areas = findProblemAreas(input.answer, redaction.redactedText);
    const fields: ExtractedField[] = [];

    if (targetPaths.length === 1 && targetPaths[0]) {
      const semantic = semanticFieldForPath(
        targetPaths[0],
        input.answer,
        redaction.redactedText,
        areas,
        clarity,
      );
      const direct = semantic ?? {
        value: safeValue,
        sourceType: isUnknown
          ? "NOT_CONFIRMED" as const
          : isEstimate
            ? "CLIENT_ESTIMATE" as const
            : "REPORTED_FACT" as const,
        confidence: isUnknown ? 1 : clarity.level === "CLEAR" ? 0.95 : 0.55,
      };
      fields.push({
        path: targetPaths[0],
        ...direct,
        evidenceText: redaction.redactedText.slice(0, 500),
      });
    } else {
      for (const path of targetPaths) {
        const semantic = semanticFieldForPath(
          path,
          input.answer,
          redaction.redactedText,
          areas,
          clarity,
        );
        if (!semantic) continue;
        fields.push({
          path,
          ...semantic,
          evidenceText: redaction.redactedText.slice(0, 500),
        });
      }
    }

    return ExtractAnswerResultSchema.parse({
      fields,
      detectedSensitiveData: redaction.redactionCount > 0,
      sensitiveDataCategories: redaction.categories,
      responseClarity: clarity.level,
      summary: redaction.redactedText.slice(0, 500),
    });
  }

  async evaluateClarity(input: EvaluateClarityInput): Promise<ClarityResult> {
    return ClarityResultSchema.parse(clarityFor(input));
  }

  async suggestClarification(input: SuggestClarificationInput): Promise<ClarificationSuggestion> {
    const question = input.question.id === "PROCESS_001"
      ? "O que acontece primeiro, quem recebe a demanda e como o processo é finalizado?"
      : "Poderia compartilhar um exemplo concreto para compreendermos melhor essa situação?";
    return ClarificationSuggestionSchema.parse({
      question,
      reason: "A resposta precisa de contexto adicional.",
      relatedQuestionId: input.question.id,
    });
  }

  async generateReview(input: GenerateReviewInput): Promise<GeneratedReview> {
    const data = input.structuredData;
    return GeneratedReviewSchema.parse({
      company: asText(data["lead.company"]),
      affectedArea: asText(data["challenge.primaryAffectedArea"]),
      challenge: asText(data["challenge.summary"]),
      currentProcess: asText(data["currentProcess.description"]),
      participants: asText(data["currentProcess.participants"]),
      systems: asStrings(data["currentProcess.systems"]),
      mainImpacts: asStrings(data["impact.categories"]),
      desiredOutcome: asText(data["challenge.desiredOutcome"]),
      priority: asText(data["buyingContext.priority"]),
      deadline: typeof data["buyingContext.deadline"] === "string"
        ? data["buyingContext.deadline"] as string
        : null,
      decisionContext: asStrings(data["buyingContext.decisionMakers"]).join(", ") || "Não informado",
    });
  }

  async generateBriefing(input: GenerateBriefingInput): Promise<GeneratedBriefing> {
    return GeneratedBriefingSchema.parse({
      executiveSummary: `${input.review.company}: ${input.review.challenge}`,
      challengeSummary: input.review.challenge,
      currentProcessSummary: input.review.currentProcess,
      impactSummary: input.review.mainImpacts.join(", ") || "Não informado",
      buyingContextSummary: input.review.decisionContext,
      technicalContextSummary: input.review.systems.join(", ") || "Não informado",
      initialHypotheses: [],
      missingInformation: input.missingCriticalPaths,
      recommendedQuestions: input.missingCriticalPaths.map((path) => `Validar ${path}`).slice(0, 15),
      recommendedParticipants: [],
    });
  }
}

export type MockAIResponses = Partial<Record<InterviewAIOperation, unknown | Error>>;

export class MockInterviewAIService implements InterviewAIService {
  readonly calls: InterviewAIOperation[] = [];
  private readonly fallback = new DeterministicInterviewAIService();
  constructor(private readonly responses: MockAIResponses = {}) {}

  private response(operation: InterviewAIOperation): unknown | undefined {
    this.calls.push(operation);
    const value = this.responses[operation];
    if (value instanceof Error) throw value;
    return value;
  }
  async extractAnswer(input: ExtractAnswerInput) {
    return ExtractAnswerResultSchema.parse(this.response("extractAnswer") ?? await this.fallback.extractAnswer(input));
  }
  async evaluateClarity(input: EvaluateClarityInput) {
    return ClarityResultSchema.parse(this.response("evaluateClarity") ?? await this.fallback.evaluateClarity(input));
  }
  async suggestClarification(input: SuggestClarificationInput) {
    return ClarificationSuggestionSchema.parse(this.response("suggestClarification") ?? await this.fallback.suggestClarification(input));
  }
  async generateReview(input: GenerateReviewInput) {
    return GeneratedReviewSchema.parse(this.response("generateReview") ?? await this.fallback.generateReview(input));
  }
  async generateBriefing(input: GenerateBriefingInput) {
    return GeneratedBriefingSchema.parse(this.response("generateBriefing") ?? await this.fallback.generateBriefing(input));
  }
}

export interface ExternalAITransport {
  invoke(operation: InterviewAIOperation, input: unknown, signal: AbortSignal): Promise<unknown>;
}

export class ExternalInterviewAIService implements InterviewAIService {
  constructor(
    private readonly transport: ExternalAITransport,
    private readonly options = { timeoutMs: 8_000, maxRetries: 1 },
  ) {}

  private async invoke(operation: InterviewAIOperation, input: unknown): Promise<unknown> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.options.maxRetries; attempt += 1) {
      const controller = new AbortController();
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeoutPromise = new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => {
            controller.abort();
            reject(new Error("AI_TIMEOUT"));
          }, this.options.timeoutMs);
        });
        return await Promise.race([
          this.transport.invoke(operation, input, controller.signal),
          timeoutPromise,
        ]);
      } catch (error) {
        lastError = error;
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    }
    throw lastError instanceof Error ? lastError : new Error("AI_PROVIDER_UNAVAILABLE");
  }
  async extractAnswer(input: ExtractAnswerInput) { return ExtractAnswerResultSchema.parse(await this.invoke("extractAnswer", input)); }
  async evaluateClarity(input: EvaluateClarityInput) { return ClarityResultSchema.parse(await this.invoke("evaluateClarity", input)); }
  async suggestClarification(input: SuggestClarificationInput) { return ClarificationSuggestionSchema.parse(await this.invoke("suggestClarification", input)); }
  async generateReview(input: GenerateReviewInput) { return GeneratedReviewSchema.parse(await this.invoke("generateReview", input)); }
  async generateBriefing(input: GenerateBriefingInput) { return GeneratedBriefingSchema.parse(await this.invoke("generateBriefing", input)); }
}

export class FallbackInterviewAIService implements InterviewAIService {
  constructor(
    private readonly primary: InterviewAIService,
    private readonly fallback: InterviewAIService = new DeterministicInterviewAIService(),
    private readonly onFallback?: (operation: InterviewAIOperation) => void,
  ) {}
  private async run<T>(operation: InterviewAIOperation, primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    try { return await primary(); } catch { this.onFallback?.(operation); return fallback(); }
  }
  extractAnswer(input: ExtractAnswerInput) { return this.run("extractAnswer", () => this.primary.extractAnswer(input), () => this.fallback.extractAnswer(input)); }
  evaluateClarity(input: EvaluateClarityInput) { return this.run("evaluateClarity", () => this.primary.evaluateClarity(input), () => this.fallback.evaluateClarity(input)); }
  suggestClarification(input: SuggestClarificationInput) { return this.run("suggestClarification", () => this.primary.suggestClarification(input), () => this.fallback.suggestClarification(input)); }
  generateReview(input: GenerateReviewInput) { return this.run("generateReview", () => this.primary.generateReview(input), () => this.fallback.generateReview(input)); }
  generateBriefing(input: GenerateBriefingInput) { return this.run("generateBriefing", () => this.primary.generateBriefing(input), () => this.fallback.generateBriefing(input)); }
}
