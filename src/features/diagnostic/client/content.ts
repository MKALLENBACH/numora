import type { DiagnosticErrorCode, InterviewStage, QuestionOption } from "./types";

export const diagnosticCopy = {
  introduction: {
    title: "Diagnóstico Inicial NUMORA",
    description:
      "Conte-nos sobre o desafio da sua operação. Vamos organizar as informações para que nossa equipe compreenda melhor o contexto antes de uma possível conversa.",
    points: [
      "Uma pergunta por vez",
      "Aproximadamente 5 a 8 minutos",
      "Você poderá revisar as informações",
      "Não compartilhe senhas ou dados confidenciais",
    ],
    disclaimer:
      "Esta etapa oferece uma compreensão inicial e não representa diagnóstico definitivo, proposta comercial ou garantia de resultado.",
  },
  privacy: {
    title: "Como utilizaremos as informações",
    description:
      "As respostas serão utilizadas para compreender sua solicitação, organizar o contexto apresentado e permitir a análise pela equipe da NUMORA.",
    checkbox: "Li e concordo com o tratamento das informações para essa finalidade.",
  },
  commercial: {
    title: "Continuidade da análise",
    description:
      "Você autoriza que a equipe da NUMORA entre em contato para dar continuidade à análise, caso o contexto apresentado esteja alinhado à nossa atuação?",
    support: "Você poderá concluir o diagnóstico mesmo sem autorizar contato.",
  },
  identification: {
    title: "Conte-nos um pouco sobre você e sua empresa",
  },
  review: {
    title: "Revise seu diagnóstico inicial",
    description: "Confira se as informações representam corretamente a situação atual.",
  },
  completion: {
    title: "Diagnóstico inicial concluído",
    withContact:
      "As informações foram registradas para análise da equipe da NUMORA. Caso seja necessário dar continuidade, o contato poderá ser realizado pelos dados informados.",
    withoutContact:
      "Seu resumo foi concluído. Como o contato não foi autorizado, nenhuma mensagem de acompanhamento será enviada.",
  },
} as const;

export const publicStages: ReadonlyArray<{ key: InterviewStage; label: string; mobile: string }> = [
  { key: "IDENTIFICATION", label: "Identificação", mobile: "Identificação" },
  { key: "CHALLENGE", label: "Desafio", mobile: "Desafio" },
  { key: "CURRENT_PROCESS", label: "Processo", mobile: "Processo atual" },
  { key: "IMPACT", label: "Impacto", mobile: "Impacto" },
  { key: "BUYING_CONTEXT", label: "Contexto", mobile: "Contexto" },
  { key: "REVIEW", label: "Revisão", mobile: "Revisão" },
];

export const industries: ReadonlyArray<QuestionOption> = [
  { value: "", label: "Selecione" },
  { value: "INDUSTRY", label: "Indústria" },
  { value: "CONSTRUCTION", label: "Construção civil" },
  { value: "LOGISTICS", label: "Logística" },
  { value: "DISTRIBUTION", label: "Distribuição" },
  { value: "HEALTHCARE", label: "Saúde" },
  { value: "B2B_SERVICES", label: "Serviços B2B" },
  { value: "TECHNOLOGY", label: "Tecnologia" },
  { value: "RETAIL", label: "Varejo" },
  { value: "FINANCIAL_SERVICES", label: "Serviços financeiros" },
  { value: "EDUCATION", label: "Educação" },
  { value: "PUBLIC_SECTOR", label: "Setor público" },
  { value: "OTHER", label: "Outro" },
];

export const companySizes: ReadonlyArray<QuestionOption> = [
  { value: "", label: "Selecione" },
  { value: "UP_TO_10", label: "Até 10 pessoas" },
  { value: "11_50", label: "11 a 50 pessoas" },
  { value: "51_100", label: "51 a 100 pessoas" },
  { value: "101_500", label: "101 a 500 pessoas" },
  { value: "501_1000", label: "501 a 1.000 pessoas" },
  { value: "ABOVE_1000", label: "Mais de 1.000 pessoas" },
  { value: "NOT_INFORMED", label: "Prefiro não informar" },
];

export const revenueRanges: ReadonlyArray<QuestionOption> = [
  { value: "", label: "Selecione" },
  { value: "UP_TO_5M", label: "Até R$ 5 milhões por ano" },
  { value: "5M_20M", label: "R$ 5 milhões a R$ 20 milhões por ano" },
  { value: "20M_100M", label: "R$ 20 milhões a R$ 100 milhões por ano" },
  { value: "100M_500M", label: "R$ 100 milhões a R$ 500 milhões por ano" },
  { value: "ABOVE_500M", label: "Acima de R$ 500 milhões por ano" },
  { value: "NOT_INFORMED", label: "Prefiro não informar" },
];

export const publicErrorMessages: Record<DiagnosticErrorCode, string> = {
  CONFIGURATION_ERROR:
    "O diagnóstico ainda não está disponível neste ambiente. Volte mais tarde ou retorne ao site.",
  VALIDATION_ERROR: "Revise as informações indicadas para continuar.",
  SESSION_EXPIRED:
    "Esta sessão expirou. Para proteger suas informações, será necessário iniciar um novo diagnóstico.",
  SESSION_NOT_FOUND: "Não encontramos uma sessão ativa neste navegador.",
  STATE_CONFLICT:
    "O diagnóstico foi atualizado em outra solicitação. Recarregamos a versão mais recente sem apagar sua resposta.",
  RATE_LIMITED:
    "Muitas solicitações foram enviadas em pouco tempo. Aguarde um momento e tente novamente.",
  AI_FALLBACK_ACTIVE:
    "Alguns recursos de interpretação estão temporariamente indisponíveis. A entrevista continuará normalmente.",
  PERSISTENCE_UNAVAILABLE:
    "Não foi possível registrar as informações com segurança neste momento. Para evitar perda de dados, a entrevista foi pausada.",
  UNAUTHORIZED: "Sua sessão não pôde ser validada. Inicie um novo diagnóstico para continuar.",
  BLOCKED: "Sem essa autorização, não podemos continuar com o diagnóstico.",
  GENERIC_ERROR:
    "Não foi possível concluir esta ação. Suas informações foram preservadas. Tente novamente.",
};
