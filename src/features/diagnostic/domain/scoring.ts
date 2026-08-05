import type {
  AssessmentConfidence,
  DiagnosticStructuredData,
  EvidenceRecord,
  QualificationAssessment,
  QualificationClassification,
  ScoreCriterionResult,
  ScoringDimension,
} from "./types";
import { getValueAtPath, isPresent, roundToTwo } from "./value-utils";

export const QUALIFICATION_SCORE_VERSION = "1.0.0";

export type QualificationInput = {
  readonly structuredData: DiagnosticStructuredData;
  readonly evidence: readonly EvidenceRecord[];
};

type ScoreCriterion = {
  readonly code: string;
  readonly dimension: ScoringDimension;
  readonly maximumPoints: number;
  readonly paths: readonly string[];
  readonly score: (data: DiagnosticStructuredData) => number;
};

const bounded = (value: number): number => Math.max(0, Math.min(1, value));

const array = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const criteria: readonly ScoreCriterion[] = [
  {
    code: "FIT_COMPANY_SIZE_MATURITY",
    dimension: "NUMORA_FIT",
    maximumPoints: 6,
    paths: ["lead.employeeRange"],
    score: ({ lead }) => {
      const ratios: Record<string, number> = {
        UP_TO_10: 0.33,
        "11_50": 0.67,
        "51_100": 0.83,
        "101_500": 1,
        "501_1000": 1,
        ABOVE_1000: 1,
        NOT_INFORMED: 0,
      };
      return ratios[lead.employeeRange ?? ""] ?? 0;
    },
  },
  {
    code: "FIT_INDUSTRY",
    dimension: "NUMORA_FIT",
    maximumPoints: 4,
    paths: ["lead.industry"],
    score: ({ lead }) =>
      lead.industry === "OTHER" ? 0.5 : lead.industry ? 1 : 0,
  },
  {
    code: "FIT_OPERATIONAL_COMPLEXITY",
    dimension: "NUMORA_FIT",
    maximumPoints: 6,
    paths: [
      "currentProcess.participantCount",
      "currentProcess.involvedAreas",
      "currentProcess.systems",
    ],
    score: ({ currentProcess }) => {
      const participants = currentProcess.participantCount ?? 0;
      const areas = currentProcess.involvedAreas?.length ?? 0;
      const systems = currentProcess.systems?.length ?? 0;
      if (participants >= 5 || areas >= 3 || systems >= 4) return 1;
      if (participants >= 2 || areas >= 2 || systems >= 2) return 0.67;
      return 0.33;
    },
  },
  {
    code: "FIT_PROBLEM_COMPATIBILITY",
    dimension: "NUMORA_FIT",
    maximumPoints: 4,
    paths: [
      "challenge.primaryAffectedArea",
      "challenge.process",
      "buyingContext.processRedesignOpenness",
    ],
    score: ({ challenge, buyingContext }) => {
      if (buyingContext.processRedesignOpenness === "AUTOMATION_ONLY") return 0.25;
      if (challenge.primaryAffectedArea && challenge.process) return 1;
      return challenge.primaryAffectedArea || challenge.process ? 0.5 : 0;
    },
  },
  {
    code: "CLARITY_PROCESS_IDENTIFIED",
    dimension: "PROBLEM_CLARITY",
    maximumPoints: 5,
    paths: ["challenge.primaryAffectedArea", "challenge.process", "challenge.summary"],
    score: ({ challenge }) =>
      challenge.primaryAffectedArea && (challenge.process || challenge.summary) ? 1 : 0.5,
  },
  {
    code: "CLARITY_SYMPTOMS_IDENTIFIED",
    dimension: "PROBLEM_CLARITY",
    maximumPoints: 3,
    paths: ["challenge.symptoms"],
    score: ({ challenge }) =>
      bounded((challenge.symptoms?.length ?? 0) / 2),
  },
  {
    code: "CLARITY_DESIRED_OUTCOME",
    dimension: "PROBLEM_CLARITY",
    maximumPoints: 3,
    paths: ["challenge.desiredOutcome"],
    score: ({ challenge }) => (challenge.desiredOutcome ? 1 : 0),
  },
  {
    code: "CLARITY_CURRENT_PROCESS",
    dimension: "PROBLEM_CLARITY",
    maximumPoints: 4,
    paths: ["currentProcess.description"],
    score: ({ currentProcess }) => {
      const length = currentProcess.description?.trim().length ?? 0;
      return length >= 120 ? 1 : length >= 40 ? 0.67 : 0.33;
    },
  },
  {
    code: "OPERATION_FREQUENCY_VOLUME",
    dimension: "OPERATIONAL_IMPACT",
    maximumPoints: 6,
    paths: ["currentProcess.frequency", "currentProcess.monthlyVolume"],
    score: ({ currentProcess }) => {
      const highFrequency = [
        "MULTIPLE_TIMES_PER_DAY",
        "DAILY",
        "MULTIPLE_TIMES_PER_WEEK",
      ].includes(currentProcess.frequency ?? "");
      const volume =
        typeof currentProcess.monthlyVolume === "number"
          ? currentProcess.monthlyVolume
          : 0;
      if (highFrequency || volume >= 500) return 1;
      if (currentProcess.frequency === "WEEKLY" || volume >= 50) return 0.67;
      return 0.33;
    },
  },
  {
    code: "OPERATION_PEOPLE_TIME",
    dimension: "OPERATIONAL_IMPACT",
    maximumPoints: 5,
    paths: [
      "currentProcess.participantCount",
      "currentProcess.averageExecutionTime",
      "impact.reportedHours",
    ],
    score: ({ currentProcess, impact }) => {
      const people = currentProcess.participantCount ?? 0;
      const hours = impact.reportedHours?.value ?? 0;
      if (people >= 5 || hours >= 40) return 1;
      if (people >= 2 || hours >= 10 || currentProcess.averageExecutionTime) return 0.67;
      return 0.33;
    },
  },
  {
    code: "OPERATION_ERRORS_DELAYS_REWORK",
    dimension: "OPERATIONAL_IMPACT",
    maximumPoints: 5,
    paths: ["impact.categories", "impact.issueFrequency"],
    score: ({ impact }) => {
      const relevant = array(impact.categories).filter((item) =>
        ["ERRORS", "DELAYS", "REWORK", "QUALITY_RISK"].includes(item),
      ).length;
      if (relevant >= 2 || ["ALMOST_ALWAYS", "FREQUENT"].includes(impact.issueFrequency ?? "")) return 1;
      return relevant === 1 || impact.issueFrequency === "SOMETIMES" ? 0.67 : 0.33;
    },
  },
  {
    code: "OPERATION_BREADTH",
    dimension: "OPERATIONAL_IMPACT",
    maximumPoints: 4,
    paths: [
      "currentProcess.involvedAreas",
      "impact.externalStakeholdersAffected",
      "impact.categories",
    ],
    score: ({ currentProcess, impact }) => {
      const areas = currentProcess.involvedAreas?.length ?? 0;
      if (impact.externalStakeholdersAffected || areas >= 3) return 1;
      if (areas >= 2 || (impact.categories?.length ?? 0) >= 3) return 0.67;
      return 0.33;
    },
  },
  {
    code: "FINANCIAL_QUANTIFIED",
    dimension: "FINANCIAL_IMPACT",
    maximumPoints: 6,
    paths: ["impact.reportedFinancialImpact"],
    score: ({ impact }) => {
      const value = impact.reportedFinancialImpact;
      if (!value || ["NOT_ESTIMATED", "PREFER_NOT_TO_SAY"].includes(value)) return 0;
      if (["200K_1M_YEAR", "ABOVE_1M_YEAR"].includes(value)) return 1;
      return 0.67;
    },
  },
  {
    code: "FINANCIAL_NATURE",
    dimension: "FINANCIAL_IMPACT",
    maximumPoints: 5,
    paths: ["impact.categories"],
    score: ({ impact }) => {
      const categories = array(impact.categories);
      if (categories.includes("REVENUE_LOSS") && categories.includes("HIGH_OPERATIONAL_COST")) return 1;
      return categories.some((item) =>
        ["REVENUE_LOSS", "HIGH_OPERATIONAL_COST"].includes(item),
      )
        ? 0.67
        : 0;
    },
  },
  {
    code: "FINANCIAL_SUSTAINED_POTENTIAL",
    dimension: "FINANCIAL_IMPACT",
    maximumPoints: 4,
    paths: [
      "currentProcess.monthlyVolume",
      "impact.reportedHours",
      "impact.riskOfInaction",
    ],
    score: ({ currentProcess, impact }) => {
      const volume =
        typeof currentProcess.monthlyVolume === "number"
          ? currentProcess.monthlyVolume
          : 0;
      const hours = impact.reportedHours?.value ?? 0;
      if (volume >= 500 || hours >= 40) return 1;
      return volume >= 50 || hours >= 10 || impact.riskOfInaction ? 0.67 : 0.33;
    },
  },
  {
    code: "URGENCY_PRIORITY",
    dimension: "URGENCY",
    maximumPoints: 4,
    paths: ["buyingContext.priority"],
    score: ({ buyingContext }) => bounded(((buyingContext.priority ?? 1) - 1) / 4),
  },
  {
    code: "URGENCY_DEADLINE",
    dimension: "URGENCY",
    maximumPoints: 3,
    paths: ["buyingContext.deadline"],
    score: ({ buyingContext }) =>
      buyingContext.deadline && !/não existe|sem prazo/i.test(buyingContext.deadline)
        ? 1
        : 0,
  },
  {
    code: "URGENCY_RISK_OF_INACTION",
    dimension: "URGENCY",
    maximumPoints: 3,
    paths: ["impact.riskOfInaction"],
    score: ({ impact }) => (impact.riskOfInaction ? 1 : 0),
  },
  {
    code: "DECISION_CONTACT_INFLUENCE",
    dimension: "DECISION_AND_EXECUTION",
    maximumPoints: 3,
    paths: ["lead.decisionInfluence"],
    score: ({ lead }) =>
      ({ HIGH: 1, MEDIUM: 0.67, LOW: 0.33, UNKNOWN: 0 }[lead.decisionInfluence ?? "UNKNOWN"]),
  },
  {
    code: "DECISION_INTERNAL_OWNER",
    dimension: "DECISION_AND_EXECUTION",
    maximumPoints: 2,
    paths: ["buyingContext.internalOwnerExists"],
    score: ({ buyingContext }) => (buyingContext.internalOwnerExists ? 1 : 0),
  },
  {
    code: "DECISION_MAKERS_SPONSORSHIP",
    dimension: "DECISION_AND_EXECUTION",
    maximumPoints: 3,
    paths: ["buyingContext.decisionMakers"],
    score: ({ buyingContext }) => {
      const makers = array(buyingContext.decisionMakers);
      if (makers.includes("EXECUTIVE_BOARD") || makers.includes("PARTNERS")) return 1;
      return makers.includes("UNDEFINED") ? 0 : makers.length > 0 ? 0.67 : 0;
    },
  },
  {
    code: "DECISION_BUDGET",
    dimension: "DECISION_AND_EXECUTION",
    maximumPoints: 2,
    paths: ["buyingContext.budgetStatus"],
    score: ({ buyingContext }) =>
      ({
        APPROVED: 1,
        PLANNED_NOT_APPROVED: 0.75,
        UNDER_ANALYSIS: 0.5,
        EXPLORATORY: 0.25,
        UNKNOWN: 0,
        PREFER_NOT_TO_SAY: 0,
      })[buyingContext.budgetStatus ?? "UNKNOWN"] ?? 0,
  },
  {
    code: "FEASIBILITY_DATA",
    dimension: "DATA_AND_FEASIBILITY",
    maximumPoints: 3,
    paths: ["technicalContext.dataAvailability"],
    score: ({ technicalContext }) =>
      ({
        AVAILABLE_STRUCTURED: 1,
        AVAILABLE_FRAGMENTED: 0.67,
        PARTIAL: 0.5,
        PRACTICALLY_UNAVAILABLE: 0,
        UNKNOWN: 0,
      })[technicalContext.dataAvailability ?? "UNKNOWN"] ?? 0,
  },
  {
    code: "FEASIBILITY_SYSTEMS_ACCESS",
    dimension: "DATA_AND_FEASIBILITY",
    maximumPoints: 2,
    paths: ["currentProcess.systems"],
    score: ({ currentProcess }) =>
      (currentProcess.systems?.length ?? 0) > 0 ? 1 : 0,
  },
  {
    code: "FEASIBILITY_TECHNICAL_AVAILABILITY",
    dimension: "DATA_AND_FEASIBILITY",
    maximumPoints: 2,
    paths: ["technicalContext.itAvailability"],
    score: ({ technicalContext }) =>
      ({
        AVAILABLE: 1,
        PROBABLE: 0.75,
        NEEDS_VALIDATION: 0.5,
        NO_INTERNAL_TEAM: 0.25,
        UNAVAILABLE: 0,
        UNKNOWN: 0,
      })[technicalContext.itAvailability ?? "UNKNOWN"] ?? 0,
  },
  {
    code: "FEASIBILITY_PROCESS_REDESIGN",
    dimension: "DATA_AND_FEASIBILITY",
    maximumPoints: 3,
    paths: ["buyingContext.processRedesignOpenness"],
    score: ({ buyingContext }) =>
      ({ OPEN: 1, OPEN_WITH_EVIDENCE: 0.75, UNDECIDED: 0.5, AUTOMATION_ONLY: 0 })[
        buyingContext.processRedesignOpenness ?? "UNDECIDED"
      ] ?? 0,
  },
];

const maximumScore = criteria.reduce(
  (total, criterion) => total + criterion.maximumPoints,
  0,
);

if (maximumScore !== 100) {
  throw new Error(`Qualification matrix must total 100 points, received ${maximumScore}`);
}

function isScorableEvidence(evidence: EvidenceRecord): boolean {
  return (
    evidence.isCurrent !== false &&
    evidence.confidence >= 0.6 &&
    evidence.sourceType !== "AI_INFERENCE" &&
    evidence.sourceType !== "NOT_CONFIRMED"
  );
}

const NON_EVIDENT_SENTINELS = new Set([
  "UNKNOWN",
  "NOT_INFORMED",
  "PREFER_NOT_TO_SAY",
  "NOT_ESTIMATED",
  "UNDEFINED",
  "NOT_MEASURED",
]);

function hasScorableValue(value: unknown): boolean {
  if (!isPresent(value)) return false;
  if (typeof value === "string") {
    return !NON_EVIDENT_SENTINELS.has(value.trim().toUpperCase());
  }
  if (Array.isArray(value)) {
    return value.some((item) => hasScorableValue(item));
  }
  return true;
}

function currentEvidenceForPath(
  path: string,
  evidence: readonly EvidenceRecord[],
): EvidenceRecord | undefined {
  let current: EvidenceRecord | undefined;
  let currentIndex = -1;

  evidence.forEach((candidate, index) => {
    if (candidate.path !== path || candidate.isCurrent === false) return;
    const candidateRevision = candidate.revision ?? 0;
    const currentRevision = current?.revision ?? 0;
    if (
      !current ||
      candidateRevision > currentRevision ||
      (candidateRevision === currentRevision && index > currentIndex)
    ) {
      current = candidate;
      currentIndex = index;
    }
  });

  return current;
}

function matchingEvidencePaths(
  criterion: ScoreCriterion,
  evidence: readonly EvidenceRecord[],
  data: DiagnosticStructuredData,
): readonly string[] {
  return criterion.paths.filter((path) => {
    const currentEvidence = currentEvidenceForPath(path, evidence);
    return currentEvidence !== undefined &&
      isScorableEvidence(currentEvidence) &&
      hasScorableValue(getValueAtPath(data, path));
  });
}

function dataRestrictedToEvidence(
  data: DiagnosticStructuredData,
  paths: readonly string[],
): DiagnosticStructuredData {
  const restricted: Record<string, unknown> = {
    lead: {},
    challenge: {},
    currentProcess: {},
    impact: {},
    buyingContext: {},
    technicalContext: {},
  };

  for (const path of paths) {
    const value = getValueAtPath(data, path);
    const segments = path.split(".");
    let target = restricted;
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index];
      if (!segment) continue;
      const existing = target[segment];
      if (typeof existing !== "object" || existing === null || Array.isArray(existing)) {
        target[segment] = {};
      }
      target = target[segment] as Record<string, unknown>;
    }
    const leaf = segments.at(-1);
    if (leaf) target[leaf] = value;
  }

  return restricted as DiagnosticStructuredData;
}

function confidenceForWeight(assessedWeight: number): AssessmentConfidence {
  if (assessedWeight >= 85) return "HIGH";
  if (assessedWeight >= 70) return "MEDIUM";
  if (assessedWeight >= 50) return "LOW";
  return "INSUFFICIENT";
}

function capForConfidence(confidence: AssessmentConfidence): number | null {
  if (confidence === "HIGH") return 100;
  if (confidence === "MEDIUM") return 79;
  if (confidence === "LOW") return 59;
  return null;
}

function classify(score: number | null): QualificationClassification {
  if (score === null) return "INSUFFICIENT";
  if (score >= 80) return "PRIORITY";
  if (score >= 60) return "QUALIFIED";
  if (score >= 40) return "INVESTIGATION";
  return "LOW_FIT";
}

export function calculateQualification(
  input: QualificationInput,
): QualificationAssessment {
  const results: ScoreCriterionResult[] = criteria.map((criterion) => {
    const evidencePaths = matchingEvidencePaths(
      criterion,
      input.evidence,
      input.structuredData,
    );
    const assessed = evidencePaths.length > 0;
    const earnedPoints = assessed
      ? roundToTwo(
          criterion.maximumPoints * bounded(
            criterion.score(
              dataRestrictedToEvidence(input.structuredData, evidencePaths),
            ),
          ),
        )
      : 0;

    return {
      code: criterion.code,
      dimension: criterion.dimension,
      maximumPoints: criterion.maximumPoints,
      assessed,
      earnedPoints,
      evidencePaths,
    };
  });

  const earnedPoints = roundToTwo(
    results.reduce((total, result) => total + result.earnedPoints, 0),
  );
  const assessedWeight = roundToTwo(
    results.reduce(
      (total, result) => total + (result.assessed ? result.maximumPoints : 0),
      0,
    ),
  );
  const assessmentConfidence = confidenceForWeight(assessedWeight);
  const scoreCapApplied = capForConfidence(assessmentConfidence);
  const normalizedScore =
    assessedWeight > 0
      ? roundToTwo((earnedPoints / assessedWeight) * 100)
      : null;
  const finalScore =
    normalizedScore === null || scoreCapApplied === null
      ? null
      : Math.round(Math.min(normalizedScore, scoreCapApplied));

  return {
    version: QUALIFICATION_SCORE_VERSION,
    earnedPoints,
    assessedWeight,
    normalizedScore,
    finalScore,
    scoreCapApplied,
    classification: classify(finalScore),
    assessmentConfidence,
    criteria: results,
  };
}

export const qualificationScoreMatrix = criteria.map(
  ({ code, dimension, maximumPoints, paths }) => ({
    code,
    dimension,
    maximumPoints,
    paths,
  }),
);
