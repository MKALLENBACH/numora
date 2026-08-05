export type ReviewDraft = {
  company: string;
  affectedArea: string;
  challenge: string;
  currentProcess: string;
  participants: string;
  systems: string[];
  mainImpacts: string[];
  desiredOutcome: string;
  priority: string;
  deadline: string | null;
  decisionContext: string;
};

const PRIVATE_COMPANY_PLACEHOLDER = "Empresa não identificada";
const OMITTED_PERSONAL_CONTEXT = "Informação pessoal omitida";
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL = /\bhttps?:\/\/[^\s]+/gi;
const LABELED_PERSONAL_DATA = /\b(?:nome|contato|respons[aá]vel|telefone|celular|e-mail|email)\s*[:=]\s*[^,;\n]{2,120}/gi;
const PHONE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}\b/g;

function minimizeText(value: string): string {
  return value
    .replace(EMAIL, "[E-MAIL OMITIDO]")
    .replace(URL, "[URL OMITIDA]")
    .replace(LABELED_PERSONAL_DATA, "[DADO PESSOAL OMITIDO]")
    .replace(PHONE, "[TELEFONE OMITIDO]");
}

export function minimizeReviewForProvider<T extends ReviewDraft>(review: T): T {
  return {
    ...review,
    company: PRIVATE_COMPANY_PLACEHOLDER,
    challenge: minimizeText(review.challenge),
    currentProcess: minimizeText(review.currentProcess),
    participants: OMITTED_PERSONAL_CONTEXT,
    systems: review.systems.map(minimizeText),
    mainImpacts: review.mainImpacts.map(minimizeText),
    desiredOutcome: minimizeText(review.desiredOutcome),
    deadline: review.deadline ? minimizeText(review.deadline) : null,
    decisionContext: OMITTED_PERSONAL_CONTEXT,
  };
}
