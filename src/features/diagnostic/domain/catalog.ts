import type { PublicQuestion, QuestionOption } from "../contracts";
import type {
  InterviewCatalog,
  InterviewQuestion,
  ProblemArea,
  QuestionCondition,
  QuestionValidation,
  ScoringDimension,
} from "./types";

export const QUESTION_CATALOG_VERSION = "1.0.0";

const options = (
  entries: readonly (readonly [value: string, label: string])[],
): readonly QuestionOption[] =>
  entries.map(([value, label]) => ({ value, label }));

const durations = options([
  ["LESS_THAN_3_MONTHS", "Há menos de 3 meses"],
  ["3_TO_6_MONTHS", "De 3 a 6 meses"],
  ["6_TO_12_MONTHS", "De 6 a 12 meses"],
  ["1_TO_3_YEARS", "De 1 a 3 anos"],
  ["MORE_THAN_3_YEARS", "Há mais de 3 anos"],
  ["UNKNOWN", "Não sei informar"],
]);

const systems = options([
  ["ERP", "ERP"],
  ["CRM", "CRM"],
  ["INTERNAL_SYSTEM", "Sistema interno"],
  ["EMAIL", "E-mail"],
  ["WHATSAPP", "WhatsApp"],
  ["SPREADSHEET", "Planilha"],
  ["PDF_DOCUMENT", "Documento PDF"],
  ["FORM", "Formulário"],
  ["PAPER", "Papel"],
  ["DATABASE", "Banco de dados"],
  ["API", "API"],
  ["OTHER", "Outro"],
]);

const processFrequencies = options([
  ["MULTIPLE_TIMES_PER_DAY", "Várias vezes ao dia"],
  ["DAILY", "Diariamente"],
  ["MULTIPLE_TIMES_PER_WEEK", "Várias vezes por semana"],
  ["WEEKLY", "Semanalmente"],
  ["MONTHLY", "Mensalmente"],
  ["EVENTUAL", "Eventualmente"],
  ["ON_DEMAND", "Sob demanda"],
  ["UNKNOWN", "Não sei informar"],
]);

const impacts = options([
  ["TIME_LOSS", "Perda de tempo"],
  ["DELAYS", "Atrasos"],
  ["REWORK", "Retrabalho"],
  ["ERRORS", "Erros"],
  ["HIGH_OPERATIONAL_COST", "Custo operacional elevado"],
  ["REVENUE_LOSS", "Perda de receita"],
  ["CUSTOMER_DISSATISFACTION", "Insatisfação de clientes"],
  ["REGULATORY_RISK", "Risco regulatório"],
  ["GROWTH_LIMITATION", "Limitação de crescimento"],
  ["PERSON_DEPENDENCY", "Dependência de pessoas"],
  ["LACK_OF_DECISION_INFORMATION", "Falta de informação para decisão"],
  ["QUALITY_RISK", "Risco de qualidade"],
  ["OTHER", "Outro"],
]);

const issueFrequencies = options([
  ["ALMOST_ALWAYS", "Quase sempre"],
  ["FREQUENT", "Frequentemente"],
  ["SOMETIMES", "Às vezes"],
  ["RARELY", "Raramente"],
  ["NOT_MEASURED", "Não é medido"],
]);

const financialRanges = options([
  ["UP_TO_10K_YEAR", "Até R$ 10 mil por ano"],
  ["10K_50K_YEAR", "De R$ 10 mil a R$ 50 mil por ano"],
  ["50K_200K_YEAR", "De R$ 50 mil a R$ 200 mil por ano"],
  ["200K_1M_YEAR", "De R$ 200 mil a R$ 1 milhão por ano"],
  ["ABOVE_1M_YEAR", "Acima de R$ 1 milhão por ano"],
  ["NOT_ESTIMATED", "Ainda não foi estimado"],
  ["PREFER_NOT_TO_SAY", "Prefiro não informar"],
]);

const budgetStatuses = options([
  ["APPROVED", "Investimento aprovado"],
  ["PLANNED_NOT_APPROVED", "Planejado, ainda não aprovado"],
  ["UNDER_ANALYSIS", "Em análise"],
  ["EXPLORATORY", "Estágio exploratório"],
  ["UNKNOWN", "Não sei informar"],
  ["PREFER_NOT_TO_SAY", "Prefiro não informar"],
]);

const decisionMakers = options([
  ["EXECUTIVE_BOARD", "Diretoria executiva"],
  ["OPERATIONS", "Operações"],
  ["FINANCE", "Financeiro"],
  ["TECHNOLOGY", "Tecnologia"],
  ["PROCUREMENT", "Compras"],
  ["LEGAL", "Jurídico"],
  ["PARTNERS", "Sócios"],
  ["OTHER", "Outro"],
  ["UNDEFINED", "Ainda não definido"],
]);

const dataAvailability = options([
  ["AVAILABLE_STRUCTURED", "Disponíveis e estruturados"],
  ["AVAILABLE_FRAGMENTED", "Disponíveis, mas fragmentados"],
  ["PARTIAL", "Parcialmente disponíveis"],
  ["PRACTICALLY_UNAVAILABLE", "Praticamente indisponíveis"],
  ["UNKNOWN", "Não sei informar"],
]);

const itAvailability = options([
  ["AVAILABLE", "Disponível"],
  ["PROBABLE", "Provavelmente disponível"],
  ["NEEDS_VALIDATION", "Precisa ser validado"],
  ["NO_INTERNAL_TEAM", "Não há equipe interna"],
  ["UNAVAILABLE", "Indisponível"],
  ["UNKNOWN", "Não sei informar"],
]);

const redesignOpenness = options([
  ["OPEN", "Sim, estamos abertos"],
  ["OPEN_WITH_EVIDENCE", "Sim, se houver evidências"],
  ["AUTOMATION_ONLY", "Buscamos apenas automatizar"],
  ["UNDECIDED", "Ainda não decidimos"],
]);

const priorityScale = options([
  ["1", "Apenas exploratória"],
  ["2", "Importante, mas sem prazo"],
  ["3", "Pretendemos avançar nos próximos meses"],
  ["4", "Precisamos iniciar em breve"],
  ["5", "É uma prioridade imediata"],
]);

type QuestionDefinition = {
  readonly id: string;
  readonly stage: InterviewQuestion["stage"];
  readonly text: string;
  readonly purpose: string;
  readonly responseType: InterviewQuestion["responseType"];
  readonly required?: boolean;
  readonly critical?: boolean;
  readonly options?: readonly QuestionOption[];
  readonly validation?: QuestionValidation;
  readonly displayCondition?: QuestionCondition;
  readonly targetPaths: readonly string[];
  readonly scoringDimensions?: readonly ScoringDimension[];
  readonly priority: number;
  readonly kind?: InterviewQuestion["kind"];
  readonly defaultClarificationType?: InterviewQuestion["defaultClarificationType"];
};

const question = (definition: QuestionDefinition): InterviewQuestion => {
  const required = definition.required ?? false;
  const critical = definition.critical ?? false;

  return Object.freeze({
    ...definition,
    version: QUESTION_CATALOG_VERSION,
    required,
    critical,
    maxClarifications: critical ? 3 : required ? 2 : 1,
    scoringDimensions: definition.scoringDimensions ?? [],
    kind: definition.kind ?? "CORE",
  });
};

const below18: QuestionCondition = { type: "QUESTION_COUNT_BELOW", limit: 18 };

const questions: readonly InterviewQuestion[] = [
  question({
    id: "CHALLENGE_001",
    stage: "CHALLENGE",
    text: "Qual processo, área ou problema você gostaria de melhorar?",
    purpose: "Identificar o problema, a área, o processo e seus sintomas.",
    responseType: "LONG_TEXT",
    required: true,
    critical: true,
    validation: { minLength: 20, maxLength: 2_000 },
    targetPaths: [
      "challenge.summary",
      "challenge.primaryAffectedArea",
      "challenge.process",
      "challenge.symptoms",
    ],
    scoringDimensions: ["PROBLEM_CLARITY", "NUMORA_FIT"],
    priority: 10,
    defaultClarificationType: "VAGUE_PROBLEM",
  }),
  question({
    id: "CHALLENGE_002",
    stage: "CHALLENGE",
    text: "O que você gostaria que mudasse depois que esse problema fosse resolvido?",
    purpose: "Identificar o resultado operacional desejado.",
    responseType: "LONG_TEXT",
    required: true,
    critical: true,
    validation: { minLength: 15, maxLength: 2_000 },
    targetPaths: ["challenge.desiredOutcome"],
    scoringDimensions: ["PROBLEM_CLARITY"],
    priority: 20,
    defaultClarificationType: "GENERIC_AUTOMATION_REQUEST",
  }),
  question({
    id: "CHALLENGE_003",
    stage: "CHALLENGE",
    text: "Há quanto tempo esse problema afeta a operação?",
    purpose: "Contextualizar a duração do problema.",
    responseType: "SINGLE_CHOICE",
    options: durations,
    targetPaths: ["challenge.existingSince"],
    scoringDimensions: ["URGENCY"],
    priority: 30,
  }),
  question({
    id: "CHALLENGE_004",
    stage: "CHALLENGE",
    text: "A empresa já tentou resolver ou reduzir esse problema?",
    purpose: "Identificar tentativas anteriores e aprendizados.",
    responseType: "YES_NO",
    targetPaths: ["challenge.previousAttempts"],
    scoringDimensions: ["NUMORA_FIT"],
    priority: 40,
  }),
  question({
    id: "CHALLENGE_004_DETAIL",
    stage: "CHALLENGE",
    text: "Descreva brevemente o que foi tentado e por que o resultado não foi suficiente.",
    purpose: "Registrar tentativas anteriores e o motivo de não terem sido suficientes.",
    responseType: "LONG_TEXT",
    required: true,
    validation: { minLength: 10, maxLength: 1_500 },
    displayCondition: {
      type: "ANSWER_EQUALS",
      questionId: "CHALLENGE_004",
      value: true,
    },
    targetPaths: ["challenge.previousAttemptDetails"],
    scoringDimensions: ["NUMORA_FIT"],
    priority: 41,
  }),
  question({
    id: "PROCESS_001",
    stage: "CURRENT_PROCESS",
    text: "Como esse processo funciona hoje, desde o início até a conclusão?",
    purpose: "Compreender o fluxo operacional atual de ponta a ponta.",
    responseType: "LONG_TEXT",
    required: true,
    critical: true,
    validation: { minLength: 40, maxLength: 3_000 },
    targetPaths: ["currentProcess.description"],
    scoringDimensions: ["PROBLEM_CLARITY", "NUMORA_FIT"],
    priority: 50,
    defaultClarificationType: "INCOMPLETE_PROCESS",
  }),
  question({
    id: "PROCESS_002",
    stage: "CURRENT_PROCESS",
    text: "Quantas pessoas participam desse processo e quais áreas estão envolvidas?",
    purpose: "Dimensionar participantes e abrangência entre áreas.",
    responseType: "LONG_TEXT",
    required: true,
    targetPaths: [
      "currentProcess.participants",
      "currentProcess.participantCount",
      "currentProcess.involvedAreas",
    ],
    scoringDimensions: ["NUMORA_FIT", "OPERATIONAL_IMPACT"],
    priority: 60,
  }),
  question({
    id: "PROCESS_003",
    stage: "CURRENT_PROCESS",
    text: "Quais sistemas, planilhas, canais ou ferramentas são utilizados nesse processo?",
    purpose: "Identificar o ecossistema técnico e operacional.",
    responseType: "MULTIPLE_CHOICE",
    required: true,
    options: systems,
    validation: { maxSelections: 12 },
    targetPaths: ["currentProcess.systems"],
    scoringDimensions: ["NUMORA_FIT", "DATA_AND_FEASIBILITY"],
    priority: 70,
  }),
  question({
    id: "PROCESS_003_OTHER",
    stage: "CURRENT_PROCESS",
    text: "Qual outra ferramenta, sistema ou canal é utilizado?",
    purpose: "Descrever a opção Outro selecionada no ecossistema operacional.",
    responseType: "SHORT_TEXT",
    required: true,
    validation: { minLength: 2, maxLength: 200 },
    displayCondition: {
      type: "ANSWER_INCLUDES",
      questionId: "PROCESS_003",
      value: "OTHER",
    },
    targetPaths: ["currentProcess.systemOther"],
    scoringDimensions: ["NUMORA_FIT", "DATA_AND_FEASIBILITY"],
    priority: 71,
  }),
  question({
    id: "PROCESS_004",
    stage: "CURRENT_PROCESS",
    text: "As mesmas informações precisam ser copiadas ou digitadas em mais de uma ferramenta?",
    purpose: "Confirmar redigitação e oportunidade de integração.",
    responseType: "YES_NO",
    displayCondition: {
      type: "ANY",
      conditions: [
        { type: "ANSWER_ARRAY_MIN_LENGTH", questionId: "PROCESS_003", minimum: 2 },
        { type: "SIGNAL_PRESENT", signal: "DUPLICATE_DATA_ENTRY" },
      ],
    },
    targetPaths: ["currentProcess.duplicateDataEntry"],
    scoringDimensions: ["NUMORA_FIT", "DATA_AND_FEASIBILITY"],
    priority: 80,
  }),
  question({
    id: "PROCESS_005",
    stage: "CURRENT_PROCESS",
    text: "Com que frequência esse processo acontece?",
    purpose: "Dimensionar recorrência operacional.",
    responseType: "SINGLE_CHOICE",
    required: true,
    options: processFrequencies,
    targetPaths: ["currentProcess.frequency"],
    scoringDimensions: ["OPERATIONAL_IMPACT"],
    priority: 90,
  }),
  question({
    id: "PROCESS_006",
    stage: "CURRENT_PROCESS",
    text: "Aproximadamente quantos casos, solicitações ou atividades desse tipo são processados por mês?",
    purpose: "Dimensionar o volume mensal.",
    responseType: "NUMBER",
    validation: { min: 0, allowUnknown: true },
    displayCondition: {
      type: "ALL",
      conditions: [
        {
          type: "ANY",
          conditions: [
            { type: "ANSWER_EQUALS", questionId: "PROCESS_005", value: "MULTIPLE_TIMES_PER_DAY" },
            { type: "ANSWER_EQUALS", questionId: "PROCESS_005", value: "DAILY" },
            { type: "ANSWER_EQUALS", questionId: "PROCESS_005", value: "MULTIPLE_TIMES_PER_WEEK" },
            { type: "ANSWER_EQUALS", questionId: "PROCESS_005", value: "WEEKLY" },
          ],
        },
        { type: "FIELD_MISSING", path: "currentProcess.monthlyVolume" },
        below18,
      ],
    },
    targetPaths: ["currentProcess.monthlyVolume"],
    scoringDimensions: ["OPERATIONAL_IMPACT", "FINANCIAL_IMPACT"],
    priority: 100,
  }),
  question({
    id: "PROCESS_007",
    stage: "CURRENT_PROCESS",
    text: "Quanto tempo, em média, é necessário para concluir uma ocorrência desse processo?",
    purpose: "Dimensionar o esforço por ocorrência.",
    responseType: "NUMBER_WITH_UNIT",
    validation: { min: 0, units: ["MINUTES", "HOURS", "DAYS", "WEEKS"] },
    displayCondition: {
      type: "ALL",
      conditions: [
        {
          type: "ANY",
          conditions: [
            { type: "SIGNAL_PRESENT", signal: "MANUAL_PROCESS" },
            { type: "ANSWER_EQUALS", questionId: "PROCESS_005", value: "MULTIPLE_TIMES_PER_DAY" },
            { type: "ANSWER_EQUALS", questionId: "PROCESS_005", value: "DAILY" },
            { type: "ANSWER_EQUALS", questionId: "PROCESS_005", value: "MULTIPLE_TIMES_PER_WEEK" },
            { type: "ANSWER_EQUALS", questionId: "PROCESS_005", value: "WEEKLY" },
          ],
        },
        { type: "FIELD_MISSING", path: "currentProcess.averageExecutionTime" },
        below18,
      ],
    },
    targetPaths: ["currentProcess.averageExecutionTime"],
    scoringDimensions: ["OPERATIONAL_IMPACT", "FINANCIAL_IMPACT"],
    priority: 110,
  }),
  question({
    id: "PROCESS_008",
    stage: "CURRENT_PROCESS",
    text: "Qual parte do processo mais depende de trabalho manual ou do conhecimento de uma pessoa específica?",
    purpose: "Identificar dependência manual ou de conhecimento tácito.",
    responseType: "LONG_TEXT",
    displayCondition: {
      type: "ALL",
      conditions: [
        { type: "FIELD_MISSING", path: "currentProcess.manualDependency" },
        below18,
      ],
    },
    targetPaths: ["currentProcess.manualDependency"],
    scoringDimensions: ["OPERATIONAL_IMPACT"],
    priority: 120,
  }),
  question({
    id: "IMPACT_001",
    stage: "IMPACT",
    text: "Quais são os principais impactos desse problema para a empresa?",
    purpose: "Classificar os impactos operacionais e empresariais.",
    responseType: "MULTIPLE_CHOICE",
    required: true,
    critical: true,
    options: impacts,
    targetPaths: ["impact.categories"],
    scoringDimensions: ["OPERATIONAL_IMPACT", "FINANCIAL_IMPACT"],
    priority: 150,
    defaultClarificationType: "IMPACT_MISSING",
  }),
  question({
    id: "IMPACT_002",
    stage: "IMPACT",
    text: "Com que frequência esses erros, atrasos ou retrabalhos acontecem?",
    purpose: "Dimensionar a frequência dos sintomas operacionais.",
    responseType: "SINGLE_CHOICE",
    options: issueFrequencies,
    displayCondition: {
      type: "ANY",
      conditions: ["ERRORS", "DELAYS", "REWORK", "QUALITY_RISK"].map((value) => ({
        type: "ANSWER_INCLUDES" as const,
        questionId: "IMPACT_001",
        value,
      })),
    },
    targetPaths: ["impact.issueFrequency"],
    scoringDimensions: ["OPERATIONAL_IMPACT"],
    priority: 160,
  }),
  question({
    id: "IMPACT_003",
    stage: "IMPACT",
    text: "Existe uma estimativa de quantas horas por semana ou por mês são consumidas por esse processo?",
    purpose: "Quantificar esforço recorrente.",
    responseType: "NUMBER_WITH_UNIT",
    validation: { min: 0, units: ["HOURS_PER_WEEK", "HOURS_PER_MONTH"], allowUnknown: true },
    displayCondition: {
      type: "ALL",
      conditions: [
        {
          type: "ANY",
          conditions: [
            { type: "ANSWER_INCLUDES", questionId: "IMPACT_001", value: "TIME_LOSS" },
            { type: "SIGNAL_PRESENT", signal: "MANUAL_PROCESS" },
            { type: "FIELD_PRESENT", path: "currentProcess.averageExecutionTime" },
            { type: "FIELD_PRESENT", path: "currentProcess.participantCount" },
          ],
        },
        { type: "FIELD_MISSING", path: "impact.reportedHours" },
        below18,
      ],
    },
    targetPaths: ["impact.reportedHours"],
    scoringDimensions: ["OPERATIONAL_IMPACT", "FINANCIAL_IMPACT"],
    priority: 170,
  }),
  question({
    id: "IMPACT_004",
    stage: "IMPACT",
    text: "A empresa possui alguma estimativa do custo ou da perda financeira causada por esse problema?",
    purpose: "Identificar impacto financeiro reportado sem induzir valor.",
    responseType: "CURRENCY_RANGE",
    options: financialRanges,
    displayCondition: {
      type: "ALL",
      conditions: [
        {
          type: "ANY",
          conditions: [
            { type: "ANSWER_INCLUDES", questionId: "IMPACT_001", value: "HIGH_OPERATIONAL_COST" },
            { type: "ANSWER_INCLUDES", questionId: "IMPACT_001", value: "REVENUE_LOSS" },
            { type: "SIGNAL_PRESENT", signal: "HIGH_VOLUME" },
            { type: "FIELD_PRESENT", path: "impact.reportedHours" },
            { type: "ANSWER_EQUALS", questionId: "BUYING_001", value: 3 },
            { type: "ANSWER_EQUALS", questionId: "BUYING_001", value: 4 },
            { type: "ANSWER_EQUALS", questionId: "BUYING_001", value: 5 },
          ],
        },
        below18,
      ],
    },
    targetPaths: ["impact.reportedFinancialImpact"],
    scoringDimensions: ["FINANCIAL_IMPACT"],
    priority: 180,
  }),
  question({
    id: "IMPACT_005",
    stage: "IMPACT",
    text: "Esse problema afeta diretamente clientes, fornecedores ou parceiros?",
    purpose: "Identificar impactos externos.",
    responseType: "YES_NO",
    displayCondition: {
      type: "ANY",
      conditions: [
        { type: "ANSWER_INCLUDES", questionId: "IMPACT_001", value: "CUSTOMER_DISSATISFACTION" },
        { type: "ANSWER_INCLUDES", questionId: "IMPACT_001", value: "DELAYS" },
        { type: "ANSWER_INCLUDES", questionId: "IMPACT_001", value: "QUALITY_RISK" },
        { type: "SIGNAL_PRESENT", signal: "EXTERNAL_STAKEHOLDER_IMPACT" },
      ],
    },
    targetPaths: ["impact.externalStakeholdersAffected"],
    scoringDimensions: ["OPERATIONAL_IMPACT"],
    priority: 190,
  }),
  question({
    id: "IMPACT_005_DETAIL",
    stage: "IMPACT",
    text: "De que maneira eles são afetados?",
    purpose: "Descrever o impacto sobre clientes, fornecedores ou parceiros.",
    responseType: "LONG_TEXT",
    required: true,
    validation: { minLength: 10, maxLength: 1_500 },
    displayCondition: {
      type: "ANSWER_EQUALS",
      questionId: "IMPACT_005",
      value: true,
    },
    targetPaths: ["impact.externalStakeholderDescription"],
    scoringDimensions: ["OPERATIONAL_IMPACT"],
    priority: 191,
  }),
  question({
    id: "IMPACT_006",
    stage: "IMPACT",
    text: "O que pode acontecer se esse problema não for resolvido nos próximos 12 meses?",
    purpose: "Identificar o risco de não agir sem induzir resposta.",
    responseType: "LONG_TEXT",
    required: true,
    critical: true,
    validation: { minLength: 15, maxLength: 2_000 },
    targetPaths: ["impact.riskOfInaction"],
    scoringDimensions: ["URGENCY", "OPERATIONAL_IMPACT"],
    priority: 200,
    defaultClarificationType: "IMPACT_MISSING",
  }),
  question({
    id: "BUYING_001",
    stage: "BUYING_CONTEXT",
    text: "Qual é a prioridade dessa iniciativa para a empresa neste momento?",
    purpose: "Registrar prioridade declarada sem inferência.",
    responseType: "SCALE",
    required: true,
    critical: true,
    options: priorityScale,
    validation: { min: 1, max: 5 },
    targetPaths: ["buyingContext.priority"],
    scoringDimensions: ["URGENCY"],
    priority: 210,
  }),
  question({
    id: "BUYING_002",
    stage: "BUYING_CONTEXT",
    text: "Existe alguma data, projeto ou evento que determine um prazo para essa iniciativa?",
    purpose: "Identificar prazo ou evento motivador.",
    responseType: "LONG_TEXT",
    displayCondition: {
      type: "ANY",
      conditions: [3, 4, 5].map((value) => ({
        type: "ANSWER_EQUALS" as const,
        questionId: "BUYING_001",
        value,
      })),
    },
    targetPaths: ["buyingContext.deadline"],
    scoringDimensions: ["URGENCY"],
    priority: 220,
  }),
  question({
    id: "BUYING_003",
    stage: "BUYING_CONTEXT",
    text: "Em relação ao investimento, em qual estágio a empresa se encontra?",
    purpose: "Compreender contexto de orçamento sem bloquear a entrevista.",
    responseType: "SINGLE_CHOICE",
    options: budgetStatuses,
    displayCondition: {
      type: "ALL",
      conditions: [
        {
          type: "ANY",
          conditions: [3, 4, 5].map((value) => ({
            type: "ANSWER_EQUALS" as const,
            questionId: "BUYING_001",
            value,
          })),
        },
        below18,
      ],
    },
    targetPaths: ["buyingContext.budgetStatus"],
    scoringDimensions: ["DECISION_AND_EXECUTION"],
    priority: 230,
  }),
  question({
    id: "BUYING_004",
    stage: "BUYING_CONTEXT",
    text: "Existe uma pessoa ou equipe responsável por conduzir essa iniciativa internamente?",
    purpose: "Confirmar a existência de responsável interno.",
    responseType: "YES_NO",
    required: true,
    critical: true,
    targetPaths: ["buyingContext.internalOwnerExists"],
    scoringDimensions: ["DECISION_AND_EXECUTION"],
    priority: 240,
  }),
  question({
    id: "BUYING_004_DETAIL",
    stage: "BUYING_CONTEXT",
    text: "Qual área ou função será responsável?",
    purpose: "Identificar a área ou função responsável pela iniciativa.",
    responseType: "SHORT_TEXT",
    required: true,
    validation: { minLength: 2, maxLength: 200 },
    displayCondition: {
      type: "ANSWER_EQUALS",
      questionId: "BUYING_004",
      value: true,
    },
    targetPaths: ["buyingContext.internalOwnerArea"],
    scoringDimensions: ["DECISION_AND_EXECUTION"],
    priority: 241,
  }),
  question({
    id: "BUYING_005",
    stage: "BUYING_CONTEXT",
    text: "Quem normalmente participa da decisão sobre iniciativas como esta?",
    purpose: "Mapear decisores e possível patrocínio.",
    responseType: "MULTIPLE_CHOICE",
    required: true,
    critical: true,
    options: decisionMakers,
    targetPaths: ["buyingContext.decisionMakers"],
    scoringDimensions: ["DECISION_AND_EXECUTION"],
    priority: 250,
  }),
  question({
    id: "BUYING_006",
    stage: "BUYING_CONTEXT",
    text: "A empresa possui dados, históricos ou registros sobre esse processo?",
    purpose: "Avaliar disponibilidade de dados sem presumir qualidade.",
    responseType: "SINGLE_CHOICE",
    required: true,
    critical: true,
    options: dataAvailability,
    targetPaths: ["technicalContext.dataAvailability"],
    scoringDimensions: ["DATA_AND_FEASIBILITY"],
    priority: 260,
  }),
  question({
    id: "BUYING_007",
    stage: "BUYING_CONTEXT",
    text: "A equipe de tecnologia ou os responsáveis pelos sistemas poderiam participar da iniciativa, caso necessário?",
    purpose: "Avaliar disponibilidade técnica para uma futura iniciativa.",
    responseType: "SINGLE_CHOICE",
    options: itAvailability,
    displayCondition: {
      type: "ALL",
      conditions: [
        {
          type: "ANY",
          conditions: [
            { type: "FIELD_PRESENT", path: "currentProcess.systems" },
            { type: "SIGNAL_PRESENT", signal: "INTEGRATION_LIKELY" },
            { type: "SIGNAL_PRESENT", signal: "GENERIC_AUTOMATION_REQUEST" },
            { type: "SIGNAL_PRESENT", signal: "GENERIC_AI_REQUEST" },
          ],
        },
        below18,
      ],
    },
    targetPaths: ["technicalContext.itAvailability"],
    scoringDimensions: ["DATA_AND_FEASIBILITY"],
    priority: 270,
  }),
  question({
    id: "BUYING_008",
    stage: "BUYING_CONTEXT",
    text: "A empresa está aberta a revisar o processo atual, além de apenas automatizá-lo?",
    purpose: "Avaliar aderência à transformação operacional.",
    responseType: "SINGLE_CHOICE",
    required: true,
    critical: true,
    options: redesignOpenness,
    targetPaths: ["buyingContext.processRedesignOpenness"],
    scoringDimensions: ["NUMORA_FIT", "DATA_AND_FEASIBILITY"],
    priority: 280,
  }),
];

const areaQuestions: Readonly<
  Record<Exclude<ProblemArea, "TECHNOLOGY" | "OTHER">, readonly [string, string]>
> = {
  COMMERCIAL: [
    "Como os leads e oportunidades são registrados e acompanhados atualmente?",
    "Em qual etapa as oportunidades costumam atrasar ou ser perdidas?",
  ],
  FINANCE: [
    "Quais atividades financeiras mais exigem conferência, digitação ou conciliação manual?",
    "Qual é o volume mensal aproximado de documentos, cobranças ou transações envolvidas?",
  ],
  CUSTOMER_SERVICE: [
    "Por quais canais os clientes entram em contato?",
    "Quais solicitações ou dúvidas aparecem com maior frequência?",
  ],
  OPERATIONS_LOGISTICS: [
    "Em qual etapa da operação ocorrem mais atrasos, desvios ou retrabalho?",
    "Existe acompanhamento em tempo real ou as informações são consolidadas posteriormente?",
  ],
  PROCUREMENT: [
    "Como são realizadas as solicitações, cotações e aprovações de compra?",
    "Quanto tempo costuma levar entre a solicitação e a aprovação final?",
  ],
  HUMAN_RESOURCES: [
    "Qual processo de RH mais consome tempo da equipe atualmente?",
    "Esse processo envolve documentos, aprovações ou comunicação repetitiva com colaboradores?",
  ],
  LEGAL: [
    "Qual é o volume aproximado de contratos ou documentos analisados por mês?",
    "Quais etapas da análise exigem mais tempo ou geram maior risco?",
  ],
};

const areaSpecificQuestions = Object.entries(areaQuestions).flatMap(
  ([area, texts], areaIndex) =>
    texts.map((text, textIndex) =>
      question({
        id: `AREA_${area}_${String(textIndex + 1).padStart(2, "0")}`,
        stage: "CURRENT_PROCESS",
        text,
        purpose: `Aprofundar o contexto da área ${area} sem exceder duas perguntas específicas.`,
        responseType: "LONG_TEXT",
        displayCondition: {
          type: "ALL",
          conditions: [
            { type: "AREA_EQUALS", area: area as ProblemArea },
            below18,
          ],
        },
        targetPaths: [`areaSpecific.${area.toLowerCase()}.${textIndex + 1}`],
        scoringDimensions: ["NUMORA_FIT", "OPERATIONAL_IMPACT"],
        priority: 125 + areaIndex * 2 + textIndex,
        kind: "AREA_SPECIFIC",
      }),
    ),
);

export const CRITICAL_FIELD_PATHS = [
  "lead.name",
  "lead.role",
  "lead.company",
  "lead.email",
  "lead.industry",
  "lead.employeeRange",
  "challenge.summary",
  "challenge.primaryAffectedArea",
  "challenge.desiredOutcome",
  "currentProcess.description",
  "impact.categories",
  "impact.riskOfInaction",
  "buyingContext.priority",
  "buyingContext.internalOwnerExists",
  "buyingContext.decisionMakers",
  "technicalContext.dataAvailability",
  "buyingContext.processRedesignOpenness",
] as const;

export const interviewCatalog: InterviewCatalog = Object.freeze({
  version: QUESTION_CATALOG_VERSION,
  questions: Object.freeze([...questions, ...areaSpecificQuestions]),
  criticalPaths: CRITICAL_FIELD_PATHS,
});

export function getQuestionById(
  id: string,
  catalog: InterviewCatalog = interviewCatalog,
): InterviewQuestion | undefined {
  return catalog.questions.find((candidate) => candidate.id === id);
}

export function toPublicQuestion(question: InterviewQuestion): PublicQuestion {
  const validation = question.validation
    ? {
        ...(question.validation.minLength === undefined
          ? {}
          : { minLength: question.validation.minLength }),
        ...(question.validation.maxLength === undefined
          ? {}
          : { maxLength: question.validation.maxLength }),
        ...(question.validation.min === undefined
          ? {}
          : { min: question.validation.min }),
        ...(question.validation.max === undefined
          ? {}
          : { max: question.validation.max }),
        ...(question.validation.maxSelections === undefined
          ? {}
          : { maxSelections: question.validation.maxSelections }),
        ...(question.validation.units
          ? { units: [...question.validation.units] }
          : {}),
        ...(question.validation.allowUnknown === undefined
          ? {}
          : { allowUnknown: question.validation.allowUnknown }),
      }
    : undefined;

  return {
    id: question.id,
    version: question.version,
    stage: question.stage,
    text: question.text,
    responseType: question.responseType,
    required: question.required,
    ...(question.options ? { options: [...question.options] } : {}),
    ...(validation ? { validation } : {}),
  };
}

export function assertInterviewCatalog(catalog: InterviewCatalog): void {
  const ids = new Set<string>();

  for (const candidate of catalog.questions) {
    if (ids.has(candidate.id)) {
      throw new Error(`Duplicate question id: ${candidate.id}`);
    }
    ids.add(candidate.id);

    if (candidate.version !== catalog.version) {
      throw new Error(`Question ${candidate.id} has a mismatched version`);
    }

    if (candidate.validation?.minLength !== undefined &&
        candidate.validation?.maxLength !== undefined &&
        candidate.validation.minLength > candidate.validation.maxLength) {
      throw new Error(`Question ${candidate.id} has invalid length limits`);
    }

    if (candidate.maxClarifications < 1 || candidate.maxClarifications > 3) {
      throw new Error(`Question ${candidate.id} has invalid clarification limit`);
    }
  }

  for (const criticalPath of catalog.criticalPaths) {
    if (!catalog.questions.some((candidate) => candidate.targetPaths.includes(criticalPath)) &&
        !criticalPath.startsWith("lead.")) {
      throw new Error(`Critical path has no catalog source: ${criticalPath}`);
    }
  }
}

assertInterviewCatalog(interviewCatalog);
