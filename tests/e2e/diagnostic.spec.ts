import { expect, test, type Page, type Route } from "@playwright/test";

type JsonObject = Record<string, unknown>;

type EdgeResult =
  | { data: PublicState; status?: number }
  | {
      error: {
        code: string;
        message: string;
        referenceCode: string;
        retryable: boolean;
      };
      status: number;
    };

type EdgeCall = {
  functionName: string;
  body: JsonObject;
};

type PublicQuestion = {
  id: string;
  version: string;
  stage: "CHALLENGE" | "CURRENT_PROCESS" | "IMPACT" | "BUYING_CONTEXT";
  text: string;
  responseType:
    | "SHORT_TEXT"
    | "LONG_TEXT"
    | "SINGLE_CHOICE"
    | "MULTIPLE_CHOICE"
    | "NUMBER"
    | "NUMBER_WITH_UNIT"
    | "CURRENCY_RANGE"
    | "DATE"
    | "YES_NO"
    | "SCALE"
    | "CONFIRMATION";
  required: boolean;
  options?: Array<{ value: string; label: string }>;
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    maxSelections?: number;
    units?: string[];
    allowUnknown?: boolean;
  };
};

type PublicReview = {
  version: number;
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
  confirmed: boolean;
};

type PublicState = {
  diagnosticId: string;
  sessionId: string;
  status:
    | "IN_PROGRESS"
    | "REVIEW"
    | "COMPLETING"
    | "COMPLETED"
    | "COMPLETED_NO_CONTACT"
    | "BLOCKED"
    | "EXPIRED";
  stage:
    | "INTRODUCTION"
    | "PRIVACY_CONSENT"
    | "COMMERCIAL_CONSENT"
    | "IDENTIFICATION"
    | "CHALLENGE"
    | "CURRENT_PROCESS"
    | "IMPACT"
    | "BUYING_CONTEXT"
    | "REVIEW"
    | "COMPLETION";
  currentQuestion: PublicQuestion | null;
  progress: {
    currentStep: number;
    totalSteps: 6;
    currentLabel: string;
    steps: Array<{
      id: "IDENTIFICATION" | "CHALLENGE" | "CURRENT_PROCESS" | "IMPACT" | "BUYING_CONTEXT" | "REVIEW";
      label: string;
      status: "UPCOMING" | "CURRENT" | "COMPLETED";
    }>;
  };
  review: PublicReview | null;
  canGoBack: boolean;
  canResume: boolean;
  saveStatus: "SAVED";
};

const diagnosticId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";
const testJwt =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjo0MTAyNDQ0ODAwLCJpYXRkIjoxNzAwMDAwMDAwLCJpc19hbm9ueW1vdXMiOnRydWUsInJvbGUiOiJhdXRoZW50aWNhdGVkIiwic3ViIjoiMzMzMzMzMzMtMzMzMy00MzMzLTgzMzMtMzMzMzMzMzMzMzMzIn0.test-signature";

const progressSteps = [
  ["IDENTIFICATION", "Identificação"],
  ["CHALLENGE", "Desafio"],
  ["CURRENT_PROCESS", "Processo atual"],
  ["IMPACT", "Impacto"],
  ["BUYING_CONTEXT", "Contexto"],
  ["REVIEW", "Revisão"],
] as const;

const stageStep: Record<PublicState["stage"], number> = {
  INTRODUCTION: 1,
  PRIVACY_CONSENT: 1,
  COMMERCIAL_CONSENT: 1,
  IDENTIFICATION: 1,
  CHALLENGE: 2,
  CURRENT_PROCESS: 3,
  IMPACT: 4,
  BUYING_CONTEXT: 5,
  REVIEW: 6,
  COMPLETION: 6,
};

function publicState(
  stage: PublicState["stage"],
  options: {
    question?: PublicQuestion | null;
    review?: PublicReview | null;
    status?: PublicState["status"];
    canResume?: boolean;
  } = {},
): PublicState {
  const currentStep = stageStep[stage];
  const terminal = stage === "COMPLETION";

  return {
    diagnosticId,
    sessionId,
    status:
      options.status ??
      (stage === "REVIEW" ? "REVIEW" : terminal ? "COMPLETED_NO_CONTACT" : "IN_PROGRESS"),
    stage,
    currentQuestion: options.question ?? null,
    progress: {
      currentStep,
      totalSteps: 6,
      currentLabel: progressSteps[currentStep - 1][1],
      steps: progressSteps.map(([id, label], index) => ({
        id,
        label,
        status: terminal
          ? "COMPLETED"
          : index + 1 < currentStep
            ? "COMPLETED"
            : index + 1 === currentStep
              ? "CURRENT"
              : "UPCOMING",
      })),
    },
    review: options.review ?? null,
    canGoBack: ["CHALLENGE", "CURRENT_PROCESS", "IMPACT", "BUYING_CONTEXT", "REVIEW"].includes(stage),
    canResume: options.canResume ?? !terminal,
    saveStatus: "SAVED",
  };
}

const baseReview: PublicReview = {
  version: 1,
  company: "Empresa Exemplo",
  affectedArea: "Operações",
  challenge: "Retrabalho e baixa previsibilidade na operação.",
  currentProcess: "Planilhas, e-mail e conferências manuais.",
  participants: "Operações, financeiro e diretoria.",
  systems: ["ERP", "Planilhas"],
  mainImpacts: ["Atrasos", "Retrabalho"],
  desiredOutcome: "Reduzir o tempo do ciclo e melhorar a previsibilidade.",
  priority: "Prioridade imediata",
  deadline: null,
  decisionContext: "A direção avaliará o diagnóstico inicial.",
  confirmed: false,
};

const questions: PublicQuestion[] = [
  {
    id: "challenge-description",
    version: "1.0.0",
    stage: "CHALLENGE",
    text: "Qual é o principal desafio operacional que você deseja resolver?",
    responseType: "LONG_TEXT",
    required: true,
    validation: { minLength: 10, maxLength: 500 },
  },
  {
    id: "process-frequency",
    version: "1.0.0",
    stage: "CURRENT_PROCESS",
    text: "Com que frequência esse processo acontece?",
    responseType: "SINGLE_CHOICE",
    required: true,
    options: [
      { value: "DAILY", label: "Todos os dias" },
      { value: "WEEKLY", label: "Toda semana" },
      { value: "MONTHLY", label: "Todo mês" },
    ],
  },
  {
    id: "impact-types",
    version: "1.0.0",
    stage: "IMPACT",
    text: "Quais impactos são percebidos hoje?",
    responseType: "MULTIPLE_CHOICE",
    required: true,
    options: [
      { value: "DELAYS", label: "Atrasos" },
      { value: "REWORK", label: "Retrabalho" },
      { value: "ERRORS", label: "Erros" },
    ],
    validation: { maxSelections: 3 },
  },
  {
    id: "time-spent",
    version: "1.0.0",
    stage: "IMPACT",
    text: "Quanto tempo a equipe dedica a essa atividade?",
    responseType: "NUMBER_WITH_UNIT",
    required: true,
    validation: {
      min: 0,
      units: ["HOURS_PER_WEEK", "HOURS_PER_MONTH"],
      allowUnknown: true,
    },
  },
  {
    id: "buying-priority",
    version: "1.0.0",
    stage: "BUYING_CONTEXT",
    text: "Qual é a prioridade dessa transformação?",
    responseType: "SCALE",
    required: true,
    options: [
      { value: "1", label: "1 — Apenas exploratória" },
      { value: "5", label: "5 — É uma prioridade imediata" },
    ],
    validation: { min: 1, max: 5 },
  },
  {
    id: "target-date",
    version: "1.0.0",
    stage: "BUYING_CONTEXT",
    text: "Existe uma data desejada para iniciar?",
    responseType: "DATE",
    required: false,
  },
];

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

async function fulfillJson(route: Route, status: number, payload: unknown) {
  await route.fulfill({
    status,
    headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
}

async function mockSupabase(
  page: Page,
  edgeHandler: (functionName: string, body: JsonObject) => EdgeResult | Promise<EdgeResult>,
) {
  const calls: EdgeCall[] = [];
  let rowVersion = 0;

  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders, body: "" });
      return;
    }

    if (url.pathname === "/auth/v1/signup") {
      const now = new Date().toISOString();
      await fulfillJson(route, 200, {
        access_token: testJwt,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: "test-refresh-token",
        user: {
          id: userId,
          aud: "authenticated",
          role: "authenticated",
          email: "",
          phone: "",
          app_metadata: { provider: "anonymous", providers: ["anonymous"] },
          user_metadata: {},
          identities: [],
          created_at: now,
          updated_at: now,
          is_anonymous: true,
        },
      });
      return;
    }

    if (url.pathname.startsWith("/functions/v1/")) {
      const functionName = url.pathname.slice("/functions/v1/".length);
      const body = (request.postDataJSON() ?? {}) as JsonObject;
      calls.push({ functionName, body });
      const result = await edgeHandler(functionName, body);

      if ("data" in result) {
        rowVersion += 1;
        await fulfillJson(route, result.status ?? 200, {
          data: result.data,
          meta: { rowVersion },
        });
      } else {
        await fulfillJson(route, result.status, { error: result.error });
      }
      return;
    }

    await fulfillJson(route, 404, { error: "Unexpected mocked Supabase request" });
  });

  return calls;
}

function sessionNotFound(): EdgeResult {
  return {
    status: 404,
    error: {
      code: "SESSION_NOT_FOUND",
      message: "No active diagnostic",
      referenceCode: "SESSION404",
      retryable: false,
    },
  };
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
      })),
    )
    .toEqual(
      expect.objectContaining({
        viewportWidth: await page.evaluate(() => window.innerWidth),
        documentWidth: await page.evaluate(() => window.innerWidth),
        bodyWidth: await page.evaluate(() => window.innerWidth),
      }),
    );
}

test.describe("Diagnóstico inicial NUMORA", () => {
  test("percorre consentimentos, identificação, perguntas, revisão editável e conclusão", async ({ page }, testInfo) => {
    let answerIndex = 0;
    let review = baseReview;
    const calls = await mockSupabase(page, async (functionName, body) => {
      switch (functionName) {
        case "diagnostic-state":
          return sessionNotFound();
        case "diagnostic-start":
          return { data: publicState("PRIVACY_CONSENT") };
        case "diagnostic-consent":
          return body.type === "PRIVACY"
            ? { data: publicState("COMMERCIAL_CONSENT") }
            : { data: publicState("IDENTIFICATION") };
        case "diagnostic-identification":
          return { data: publicState("CHALLENGE", { question: questions[0] }) };
        case "diagnostic-submit-answer": {
          answerIndex += 1;
          return answerIndex < questions.length
            ? { data: publicState(questions[answerIndex].stage, { question: questions[answerIndex] }) }
            : { data: publicState("REVIEW", { review: null }) };
        }
        case "diagnostic-generate-review":
          return { data: publicState("REVIEW", { review }) };
        case "diagnostic-update-review":
          review = {
            ...review,
            version: review.version + 1,
            challenge: String(body.value),
          };
          return { data: publicState("REVIEW", { review }) };
        case "diagnostic-confirm-review":
          review = { ...review, confirmed: true };
          return {
            data: publicState("REVIEW", {
              review,
              status: "COMPLETING",
            }),
          };
        case "diagnostic-complete":
          return {
            data: publicState("COMPLETION", {
              review,
              status: "COMPLETED_NO_CONTACT",
              canResume: false,
            }),
          };
        default:
          throw new Error(`Unexpected Edge Function: ${functionName}`);
      }
    });

    await page.goto("diagnostico/");
    await expect(page.getByRole("heading", { name: "Diagnóstico Inicial NUMORA" })).toBeVisible();
    await page.getByRole("button", { name: "Começar diagnóstico" }).click();

    await expect(page.getByRole("heading", { name: "Como utilizaremos as informações" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();
    await page.getByRole("checkbox", { name: /Li e concordo/ }).check();
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page.getByRole("heading", { name: "Continuidade da análise" })).toBeVisible();
    await page.getByRole("radio", { name: "Não autorizo" }).check();
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(
      page.getByRole("heading", { name: "Conte-nos um pouco sobre você e sua empresa" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByLabel("Nome")).toBeFocused();
    await expect(page.getByText("Precisamos desta informação para continuar.").first()).toBeVisible();

    await page.getByLabel("Nome").fill("Ana Souza");
    await page.getByLabel("Cargo ou função").fill("Diretora de Operações");
    await page.getByLabel("Empresa", { exact: true }).fill("Empresa Exemplo");
    await page.getByLabel("E-mail profissional").fill("ana@empresa.example");
    await page.getByLabel("Setor").selectOption({ label: "Outro" });
    await page.getByLabel("Qual setor?").fill("Energia");
    await page.getByLabel("Porte da empresa").selectOption({ label: "101 a 500 pessoas" });
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page.getByRole("heading", { name: questions[0].text })).toBeVisible();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Precisamos desta informação para continuar.")).toBeVisible();
    await page.getByLabel("Sua resposta").fill("Curto");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText(/use pelo menos 10 caracteres/)).toBeVisible();
    await page.getByLabel("Sua resposta").fill("Há retrabalho recorrente e pouca previsibilidade.");
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page.getByRole("heading", { name: questions[1].text })).toBeVisible();
    await page.getByRole("button", { name: "Voltar", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Respostas anteriores" })).toContainText(
      "Há retrabalho recorrente",
    );
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Respostas anteriores" })).toBeHidden();
    await page.getByRole("radio", { name: "Todos os dias" }).check();
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page.getByRole("heading", { name: questions[2].text })).toBeVisible();
    await page.getByRole("checkbox", { name: "Atrasos" }).check();
    await page.getByRole("checkbox", { name: "Retrabalho" }).check();
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page.getByRole("heading", { name: questions[3].text })).toBeVisible();
    await page.getByRole("checkbox", { name: "Não sei informar" }).check();
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page.getByRole("heading", { name: questions[4].text })).toBeVisible();
    await page.getByRole("radio", { name: /5.*prioridade imediata/i }).check();
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page.getByRole("heading", { name: questions[5].text })).toBeVisible();
    await page.getByRole("button", { name: "Pular por enquanto" }).click();

    await expect(page.getByRole("heading", { name: "Revise seu diagnóstico inicial" })).toBeVisible();
    const reviewScreenshot = testInfo.outputPath("diagnostic-review.png");
    await page.screenshot({ path: reviewScreenshot, fullPage: true });
    await testInfo.attach("diagnostic-review", {
      path: reviewScreenshot,
      contentType: "image/png",
    });
    await page.getByRole("button", { name: "Editar Desafio principal" }).click();
    await page.getByLabel("Informação revisada").fill("Retrabalho concentrado na conferência de pedidos.");
    await page.getByRole("button", { name: "Salvar alteração" }).click();
    await expect(page.getByText("Retrabalho concentrado na conferência de pedidos.")).toBeVisible();

    await page.getByRole("button", { name: "Confirmar informações" }).click();
    await expect(page.getByRole("heading", { name: "Diagnóstico inicial concluído" })).toBeVisible();
    await expect(page.getByText(/nenhuma mensagem de acompanhamento será enviada/i)).toBeVisible();
    const completionScreenshot = testInfo.outputPath("diagnostic-completion.png");
    await page.screenshot({ path: completionScreenshot, fullPage: true });
    await testInfo.attach("diagnostic-completion", {
      path: completionScreenshot,
      contentType: "image/png",
    });

    const byFunction = (name: string) => calls.filter((call) => call.functionName === name);
    expect(byFunction("diagnostic-consent").map((call) => call.body.decision)).toEqual([
      "ACCEPTED",
      "DECLINED",
    ]);
    expect(byFunction("diagnostic-identification")[0].body).toMatchObject({
      company: {
        name: "Empresa Exemplo",
        industry: "OTHER",
        industryOther: "Energia",
        size: "101_500",
      },
      lead: {
        name: "Ana Souza",
        role: "Diretora de Operações",
        email: "ana@empresa.example",
      },
    });
    const answerCalls = byFunction("diagnostic-submit-answer");
    expect(answerCalls.map((call) => call.body.value)).toEqual([
      "Há retrabalho recorrente e pouca previsibilidade.",
      "DAILY",
      ["DELAYS", "REWORK"],
      { unknown: true },
      5,
      "",
    ]);
    expect(answerCalls.at(-1)?.body.responseType).toBe("SKIPPED");
    const answerRowVersions = answerCalls.map((call) => call.body.rowVersion);
    expect(answerRowVersions.every((value) => typeof value === "number")).toBe(true);
    expect(answerRowVersions).toEqual(
      [...(answerRowVersions as number[])].sort((left, right) => left - right),
    );
    expect(byFunction("diagnostic-confirm-review")).toHaveLength(1);
    expect(byFunction("diagnostic-complete")).toHaveLength(1);
    const mutationRequestIds = [
      byFunction("diagnostic-confirm-review")[0].body.clientRequestId,
      byFunction("diagnostic-complete")[0].body.clientRequestId,
    ];
    expect(mutationRequestIds).toEqual([
      expect.stringMatching(/^[0-9a-f-]{36}$/),
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    ]);
  });

  test("oferece retomada de sessão sem iniciar outro diagnóstico", async ({ page }) => {
    const resumeQuestion: PublicQuestion = {
      id: "resume-process",
      version: "1.0.0",
      stage: "CURRENT_PROCESS",
      text: "Como esse processo funciona hoje?",
      responseType: "LONG_TEXT",
      required: true,
      validation: { minLength: 10, maxLength: 800 },
    };
    const calls = await mockSupabase(page, (functionName) => {
      if (functionName === "diagnostic-state") {
        return {
          data: publicState("CURRENT_PROCESS", {
            question: resumeQuestion,
            canResume: true,
          }),
        };
      }
      throw new Error(`Unexpected Edge Function: ${functionName}`);
    });

    await page.goto("diagnostico/");
    await page.getByRole("button", { name: "Começar diagnóstico" }).click();
    const resumeDialog = page.getByRole("dialog", { name: "Continue seu diagnóstico" });
    await expect(resumeDialog).toBeVisible();
    await resumeDialog.getByRole("button", { name: "Continuar diagnóstico" }).click();

    await expect(page.getByRole("heading", { name: resumeQuestion.text })).toBeVisible();
    expect(calls.filter((call) => call.functionName === "diagnostic-start")).toHaveLength(0);
  });

  test("traduz erro tipado e permite repetir a mesma ação", async ({ page }) => {
    let startAttempts = 0;
    const calls = await mockSupabase(page, (functionName) => {
      if (functionName === "diagnostic-state") return sessionNotFound();
      if (functionName === "diagnostic-start") {
        startAttempts += 1;
        if (startAttempts === 1) {
          return {
            status: 429,
            error: {
              code: "RATE_LIMITED",
              message: "Internal message not exposed",
              referenceCode: "TESTERR01",
              retryable: true,
            },
          };
        }
        return { data: publicState("PRIVACY_CONSENT") };
      }
      throw new Error(`Unexpected Edge Function: ${functionName}`);
    });

    await page.goto("diagnostico/");
    await page.getByRole("button", { name: "Começar diagnóstico" }).click();

    await expect(page.getByRole("heading", { name: "Suas informações foram preservadas" })).toBeVisible();
    await expect(page.getByText(/Muitas solicitações foram enviadas/)).toBeVisible();
    await expect(page.getByText("Código de referência: TESTERR01")).toBeVisible();
    await page.getByRole("button", { name: "Tentar novamente" }).click();

    await expect(page.getByRole("heading", { name: "Como utilizaremos as informações" })).toBeVisible();
    const startCalls = calls.filter((call) => call.functionName === "diagnostic-start");
    expect(startCalls).toHaveLength(2);
    expect(startCalls[0].body.clientRequestId).toBe(startCalls[1].body.clientRequestId);
    expect(startCalls[0].body.clientRequestId).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/));
  });

  test("bloqueia avanço ao detectar dados sensíveis na identificação (CT-089)", async ({ page }) => {
    const calls = await mockSupabase(page, async (functionName, body) => {
      if (functionName === "diagnostic-state") return sessionNotFound();
      if (functionName === "diagnostic-start") return { data: publicState("IDENTIFICATION") };
      if (functionName === "diagnostic-identification") {
        return {
          status: 422,
          error: {
            code: "VALIDATION_ERROR",
            message: "Revise as informações indicadas para continuar.",
            referenceCode: "NUM3B608E9DC732",
            retryable: true,
          },
        };
      }
      throw new Error(`Unexpected Edge Function: ${functionName}`);
    });

    await page.goto("diagnostico/");
    await page.getByRole("button", { name: "Começar diagnóstico" }).click();

    await expect(page.getByRole("heading", { name: "Conte-nos um pouco sobre você e sua empresa" })).toBeVisible();

    await page.getByLabel("Nome").fill("Matheus Kallenbach");
    await page.getByLabel("Cargo ou função").fill("QA");
    await page.getByLabel("Empresa", { exact: true }).fill("Teste S/A");
    await page.getByLabel("E-mail profissional").fill("qa@teste.com.br");
    await page.getByLabel("Setor").selectOption({ label: "Outro" });
    await page.getByLabel("Qual setor?").fill("Tecnologia");
    await page.getByLabel("Porte da empresa").selectOption({ label: "Até 10 pessoas" });
    
    // Simulate submitting sensitive data in a field to trigger the mock VALIDATION_ERROR
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page.getByText("Revise as informações indicadas para continuar.")).toBeVisible();
    
    // Should stay on the same step
    await expect(page.getByRole("heading", { name: "Conte-nos um pouco sobre você e sua empresa" })).toBeVisible();
    
    const idCalls = calls.filter((call) => call.functionName === "diagnostic-identification");
    expect(idCalls).toHaveLength(1);
  });

  for (const width of [320, 390]) {
    test(`mantém navegação por teclado e não cria rolagem horizontal em ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("diagnostico/");

      await expect(page.getByRole("heading", { name: "Diagnóstico Inicial NUMORA" })).toBeVisible();
      await expect(page.getByRole("main")).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await page.keyboard.press("Tab");
      const skipLink = page.getByRole("link", { name: "Ir para o conteúdo" });
      await expect(skipLink).toBeFocused();
      await expect(skipLink).toBeVisible();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("main")).toBeFocused();
      const screenshotPath = testInfo.outputPath(`diagnostic-introduction-${width}px.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      await testInfo.attach(`diagnostic-introduction-${width}px`, {
        path: screenshotPath,
        contentType: "image/png",
      });

      const interactiveElements = page.locator("a[href], button, input, select, textarea");
      const count = await interactiveElements.count();
      for (let index = 0; index < count; index += 1) {
        const box = await interactiveElements.nth(index).boundingBox();
        if (!box) continue;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      }
    });
  }
});
