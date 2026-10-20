// Extension of check-visual-refinement.mjs. Only synthetic, intercepted requests.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { GENERATED_INTERVIEW_CATALOG } from "../supabase/functions/_shared/generated/question-catalog.ts";

export async function runFinalCorrections({ page, f, query, check, capture, results, controls, showPublic, state, origin, base, setRole }) {
  await page.goto(`${origin}${base}/`);
  await page.evaluate(() => document.fonts.ready);
  check(`Exportação ${base || "/"}: Inter local carregada`, await page.evaluate(() => [...document.fonts].some(font => /inter/i.test(font.family) && font.status === "loaded")));
  await page.locator(".hero__actions a").first().click();
  await page.waitForURL(url => url.pathname.replace(/\/$/, "") === `${base}/diagnostico`);
  await page.getByRole("heading", { level: 1 }).waitFor();
  check(`Exportação ${base || "/"}: CTA abre diagnóstico`, true);
  setRole("ADMIN");
  const listUrl = `${origin}${base}/adm/diagnosticos/`;
  const detailUrl = `${origin}${base}/adm/diagnostico/?id=${f.diagnosticId}`;
  await page.goto(listUrl);
  await page.locator(".admin-diagnostic-card").first().waitFor({ state: "attached" });
  const visibleFocus = () => page.evaluate(() => {
    const element = document.activeElement;
    const rect = element?.getBoundingClientRect();
    return Boolean(rect?.width && rect?.height && rect.top >= 0 && rect.bottom <= innerHeight && getComputedStyle(element).visibility !== "hidden");
  });
  for (const [from, to] of [[900, 901], [899, 1024]]) {
    await page.setViewportSize({ width: from, height: 900 });
    await page.evaluate(() => { document.body.style.overflow = "auto"; });
    await page.getByRole("button", { name: "Menu", exact: true }).focus();
    await page.keyboard.press("Space");
    await page.getByRole("dialog", { name: "Menu do ADM" }).waitFor();
    check(`Drawer ${from}: bloqueia rolagem enquanto aberto`, await page.evaluate(() => document.body.style.overflow === "hidden"));
    await page.keyboard.press("Shift+Tab");
    check("Drawer: Shift+Tab mantém foco no último controle", await page.getByRole("dialog").getByRole("button", { name: "Sair", exact: true }).evaluate(e => e === document.activeElement));
    await page.keyboard.press("Tab");
    check("Drawer: Tab retorna ao primeiro controle", await page.getByRole("button", { name: "Fechar menu" }).evaluate(e => e === document.activeElement));
    await page.setViewportSize({ width: to, height: 900 });
    await page.waitForFunction(() => !document.getElementById("admin-mobile-drawer") && document.body.style.overflow === "auto");
    check(`Drawer ${from}→${to}: restaura overflow anterior e remove diálogo`, await page.getByRole("dialog", { name: "Menu do ADM" }).count() === 0);
    check(`Drawer ${from}→${to}: foco visível na navegação atual`, await visibleFocus() && await page.locator('.admin-sidebar a[aria-current="page"]').evaluate(e => e === document.activeElement));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    check(`Drawer ${from}→${to}: documento rola`, await page.evaluate(() => scrollY > 0 || document.documentElement.scrollHeight <= innerHeight));
    await page.setViewportSize({ width: from, height: 900 });
    check(`Drawer ${to}→${from}: volta fechado`, await page.getByRole("button", { name: "Menu", exact: true }).getAttribute("aria-expanded") === "false");
  }
  for (const closing of ["Escape", "backdrop", "button", "Escape"]) {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    if (closing === "Escape") await page.keyboard.press("Escape");
    else if (closing === "backdrop") await page.locator(".admin-drawer-backdrop").click({ position: { x: 880, y: 300 } });
    else await page.getByRole("button", { name: "Fechar menu" }).click();
    await page.waitForFunction(() => document.body.style.overflow === "auto");
    check(`Drawer fecha por ${closing} e devolve foco`, await visibleFocus() && await page.getByRole("button", { name: "Menu", exact: true }).evaluate(e => e === document.activeElement));
  }
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("dialog", { name: "Menu do ADM" }).getByRole("link", { name: "Perfil", exact: true }).click();
  await page.waitForURL(`${origin}${base}/adm/perfil/`);
  await page.locator(".admin-page h1").waitFor();
  check("Drawer: navegação fecha e libera rolagem", await page.evaluate(() => !document.getElementById("admin-mobile-drawer") && document.body.style.overflow !== "hidden"));

  // Response variations use the existing list contract, without changing queries or data.
  const variants = [
    { name: "presentes", values: {}, expected: ["Tecnologia", "51 a 100 pessoas", "Diretor"] },
    { name: "ausentes", values: { industry: null, employeeRange: null, contactRole: null }, expected: ["Setor não informado", "Porte não informado", "Cargo não informado"] },
    { name: "longos", values: { industry: "FINANCIAL_SERVICES", employeeRange: "ABOVE_1000", contactRole: "Diretora de operações e transformação de processos interdepartamentais em unidades internacionais" }, expected: ["Serviços financeiros", "Mais de 1.000 pessoas", "Diretora de operações e transformação de processos interdepartamentais em unidades internacionais"] },
  ];
  for (const variant of variants) {
    controls.listTransform = data => ({ ...data, items: data.items.map(item => ({ ...item, ...variant.values })) });
    await page.goto(listUrl);
    await page.locator(".admin-diagnostic-card").first().waitFor({ state: "attached" });
    for (const width of [320, 390, 768, 900, 901, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const container = width <= 900 ? page.locator(".admin-diagnostic-card").first() : page.locator(".admin-diagnostics-table tbody tr").first();
      await container.waitFor();
      // Desktop historically omits an absent employee range; the card explicitly labels it.
      const expected = variant.name === "ausentes" && width > 900 ? ["Setor não informado", "Cargo não informado"] : variant.expected;
      for (const value of expected) check(`Metadados ${variant.name} ${width}: ${value}`, (await container.innerText()).includes(value));
      check(`Card/tabela ${variant.name} ${width}: sem overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await capture(`correcao-cards-${variant.name}`, [320, 390, 900]);
  }
  controls.listTransform = null;

  await showPublic(state("REVIEW", "REVIEW"));
  await page.setViewportSize({ width: 390, height: 844 });
  const edit = page.getByRole("button", { name: "Editar Empresa", exact: true });
  results.contrast = [];
  for (const interaction of ["normal", "hover", "focus", "active"]) {
    if (interaction === "normal") await page.locator("h1").focus();
    if (interaction === "hover") await edit.hover();
    if (interaction === "focus") await edit.focus();
    if (interaction === "active") await page.mouse.down();
    const pair = await edit.evaluate(element => {
      const color = getComputedStyle(element).color;
      let node = element;
      while (node && getComputedStyle(node).backgroundColor === "rgba(0, 0, 0, 0)") node = node.parentElement;
      return { color, background: getComputedStyle(node).backgroundColor, outline: getComputedStyle(element).outlineWidth };
    });
    const luminance = rgb => rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const values = [luminance(pair.color), luminance(pair.background)].sort((a, b) => b - a);
    const ratio = (values[0] + .05) / (values[1] + .05);
    results.contrast.push({ interaction, ...pair, ratio });
    check(`Editar ${interaction}: contraste AA calculado do CSS renderizado`, ratio >= 4.5);
    if (interaction === "focus") check("Editar: foco visível", parseFloat(pair.outline) >= 2);
    if (interaction === "active") { await page.mouse.move(1, 1); await page.mouse.up(); }
  }
  await capture("correcao-contraste-revisao", [320, 1440]);

  // Commands go through the actual UI, client contract and in-memory SQL implementation.
  controls.commandMode = "success";
  for (const role of ["ADMIN", "CONSULTANT"]) {
    setRole(role);
    await page.goto(`${detailUrl}#notas`);
    await page.reload();
    await page.locator(".admin-workflow-summary h2").waitFor();
    if (role === "CONSULTANT") {
      check("CONSULTANT sem atribuição não recebe formulário de notas", await page.locator("#note-body").count() === 0);
      await page.getByRole("button", { name: "Assumir diagnóstico", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Assumir diagnóstico", exact: true }).click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
    }
    await page.locator("#note-body").waitFor();
    const text = `Nota sintética de validação final ${role}`;
    await page.locator("#note-body").fill(text);
    const count = results.commands.length;
    controls.commandMode = "held";
    await page.getByRole("button", { name: "Adicionar nota", exact: true }).click();
    await page.getByRole("button", { name: "Salvando…", exact: true }).waitFor();
    check(`${role}: busy desabilita envio e edição`, await page.getByRole("button", { name: "Salvando…", exact: true }).isDisabled() && await page.locator("#note-body").isDisabled());
    await page.keyboard.press("Enter");
    while (!controls.releaseCommand) await new Promise(resolve => setTimeout(resolve, 20));
    controls.commandMode = "success";
    controls.releaseCommand(); controls.releaseCommand = null;
    await page.locator(".admin-workflow-history").getByText(text, { exact: true }).waitFor();
    check(`${role}: um único envio persistido e rascunho limpo`, results.commands.length === count + 1 && await page.locator("#note-body").inputValue() === "");
    await page.reload();
    await page.locator(".admin-workflow-history").getByText(text, { exact: true }).waitFor();
    check(`${role}: nota permanece após recarga`, true);
  }
  setRole("VIEWER");
  await page.reload();
  await page.locator(".admin-workflow-history").waitFor();
  check("VIEWER lê notas sem formulário de escrita", await page.locator("#note-body").count() === 0);
  const w = await query("select public.admin_read_workflow($1,$2) value", [f.viewer, f.diagnosticId]);
  await assert.rejects(query("select public.admin_apply_diagnostic_command($1,$2::jsonb,null) value", [f.viewer, JSON.stringify({ command: "ADD_NOTE", payload: { category: "GENERAL", body: "Tentativa sintética bloqueada" }, diagnosticId: f.diagnosticId, clientRequestId: crypto.randomUUID(), expectedReviewVersion: w.workflow.rowVersion, expectedDiagnosticVersion: w.workflow.diagnosticVersion })]), /ACCESS_DENIED/);
  check("VIEWER: SQL rejeita tentativa de escrita", true);

  setRole("ADMIN");
  await page.reload();
  await page.getByRole("button", { name: "Prioridade", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await page.locator("#workflow-priority").selectOption("URGENT");
  const beforeReason = results.commands.length;
  await dialog.getByRole("button", { name: "Definir prioridade administrativa", exact: true }).click();
  check("Motivo obrigatório impede envio vazio", results.commands.length === beforeReason && await page.locator("#workflow-reason").evaluate(e => e.validity.valueMissing));
  await page.locator("#workflow-reason").fill("Validação sintética de prioridade urgente.");
  controls.commandMode = "conflict";
  await dialog.getByRole("button", { name: "Definir prioridade administrativa", exact: true }).click();
  await dialog.getByRole("button", { name: "Recarregar dados", exact: true }).waitFor();
  check("Conflito bloqueia reenvio até recarga", await dialog.getByRole("button", { name: "Definir prioridade administrativa", exact: true }).isDisabled());
  await dialog.getByRole("button", { name: "Recarregar dados", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector(".admin-workflow-error"));
  controls.commandMode = "failure";
  await dialog.getByRole("button", { name: "Definir prioridade administrativa", exact: true }).click();
  await dialog.getByRole("alert").waitFor();
  check("Falha preserva motivo", await page.locator("#workflow-reason").inputValue() === "Validação sintética de prioridade urgente.");
  controls.commandMode = "success";
  await dialog.getByRole("button", { name: "Definir prioridade administrativa", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  check("Prioridade aplicada após retry", (await page.locator(".admin-workflow-summary").innerText()).includes("Urgente"));
  for (const [tab, action, confirmation] of [["qualificacao", "Recalcular qualificação", "Recalcular a qualificação"], ["briefing", "Regenerar briefing", "Regenerar briefing"]]) {
    await page.goto(`${detailUrl}#${tab}`);
    await page.getByRole("button", { name: action, exact: true }).click();
    await dialog.getByRole("button", { name: confirmation, exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    const history = await query("select public.admin_read_workflow_history($1,$2,$3) value", [f.admin, f.diagnosticId, tab === "qualificacao" ? "QUALIFICATION" : "BRIEFING"]);
    check(`${action}: versão nova e anterior preservadas`, history.items.length >= 2);
  }
  await capture("correcao-workflow-sucesso", [320, 1440]);

  // Public transport fixtures exercise UI submissions and transitions, not production persistence.
  const publicRequests = [];
  const first = GENERATED_INTERVIEW_CATALOG.questions.find(q => q.responseType === "LONG_TEXT");
  const question = Object.fromEntries(Object.entries(first).filter(([key]) => ["id", "version", "stage", "text", "responseType", "required", "options", "validation"].includes(key)));
  let publicConflict = false;
  let commercialDeclined = false;
  controls.publicHandler = async (endpoint, body, current) => {
    publicRequests.push({ endpoint, body });
    if (endpoint === "diagnostic-consent") {
      if (body.type === "COMMERCIAL") commercialDeclined = body.decision === "DECLINED";
      return { state: state(current.stage === "PRIVACY_CONSENT" ? "COMMERCIAL_CONSENT" : "IDENTIFICATION") };
    }
    if (endpoint === "diagnostic-identification") return { state: state(first.stage, "IN_PROGRESS", question) };
    if (endpoint === "diagnostic-submit-answer") {
      if (publicConflict) { publicConflict = false; return { status: 409, error: { code: "STATE_CONFLICT" } }; }
      return { state: state("REVIEW", "REVIEW") };
    }
    if (endpoint === "diagnostic-update-review") return { state: { ...current, review: { ...current.review, [body.sectionKey]: body.value, version: current.review.version + 1 } } };
    if (endpoint === "diagnostic-confirm-review") return { state: { ...current, review: { ...current.review, confirmed: true } } };
    if (endpoint === "diagnostic-complete") return { state: state("COMPLETION", commercialDeclined ? "COMPLETED_NO_CONTACT" : "COMPLETED") };
    return { state: current };
  };
  // Start this independent submission scenario without the draft intentionally retained by the matrix.
  await page.evaluate(() => localStorage.removeItem("numora.diagnostic.draft.v1"));
  await showPublic(state("PRIVACY_CONSENT"));
  await page.getByRole("checkbox").focus(); await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Sim, autorizo", { exact: true }).check();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.locator("#identification-name").fill("Pessoa Fixture");
  await page.locator("#identification-role").fill("Diretora");
  await page.locator("#identification-company").fill("Empresa Fixture");
  await page.locator("#identification-email").fill("pessoa@example.invalid");
  await page.locator("#identification-industry").selectOption("TECHNOLOGY");
  await page.locator("#identification-companySize").selectOption("51_100");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.locator("#question-title").waitFor();
  check("Identificação aceita opcionais vazios e chega à pergunta", publicRequests.some(r => r.endpoint === "diagnostic-identification"));
  await page.locator("textarea").fill("");
  await page.waitForFunction(() => document.querySelector('.diagnostic-field__meta span')?.textContent?.startsWith("0/"));
  const beforeAnswer = publicRequests.filter(r => r.endpoint === "diagnostic-submit-answer").length;
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  check("Pergunta obrigatória vazia não envia", publicRequests.filter(r => r.endpoint === "diagnostic-submit-answer").length === beforeAnswer);
  await page.locator("textarea").fill("Resposta sintética suficiente para validar revisão e transição.");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Editar Empresa", exact: true }).click();
  await page.getByRole("dialog").locator("textarea,input:not([type=hidden])").first().fill("Empresa corrigida na fixture");
  await page.getByRole("dialog").getByRole("button", { name: /Salvar/ }).click();
  await page.getByText("Empresa corrigida na fixture", { exact: true }).waitFor();
  check("Edição da revisão enviada e refletida", publicRequests.some(r => r.endpoint === "diagnostic-update-review"));
  await capture("correcao-revisao-editada", [320, 1440]);
  await page.getByRole("button", { name: "Confirmar informações", exact: true }).click();
  await page.locator("#completion-title").waitFor();
  check("Confirmação e conclusão: uma solicitação de cada", publicRequests.filter(r => r.endpoint === "diagnostic-confirm-review").length === 1 && publicRequests.filter(r => r.endpoint === "diagnostic-complete").length === 1);
  await showPublic(state(first.stage, "IN_PROGRESS", question));
  publicConflict = true;
  await page.locator("textarea").fill("Rascunho sintético preservado após conflito de versão.");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.locator(".diagnostic-notice").waitFor();
  check("Conflito público preserva rascunho", await page.evaluate(() => localStorage.getItem("numora.diagnostic.draft.v1")?.includes("Rascunho sintético preservado")));
  await capture("correcao-conflito-publico", [320, 1440]);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.locator("#review-title").waitFor();
  check("Conflito público: atualização e nova tentativa chegam à revisão", true);
  const optional = GENERATED_INTERVIEW_CATALOG.questions.find(q => q.required === false);
  const optionalQuestion = Object.fromEntries(Object.entries(optional).filter(([key]) => ["id", "version", "stage", "text", "responseType", "required", "options", "validation"].includes(key)));
  await showPublic(state(optional.stage, "IN_PROGRESS", optionalQuestion));
  await page.getByRole("button", { name: "Pular por enquanto", exact: true }).click();
  await page.locator("#review-title").waitFor();
  check("Pergunta opcional envia SKIPPED", publicRequests.some(r => r.endpoint === "diagnostic-submit-answer" && r.body.responseType === "SKIPPED"));
  await showPublic(state("COMMERCIAL_CONSENT"));
  await page.getByLabel("Não autorizo", { exact: true }).check();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.locator("#identification-name").waitFor();
  check("Recusa de contato enviada explicitamente", publicRequests.some(r => r.endpoint === "diagnostic-consent" && r.body.type === "COMMERCIAL" && r.body.decision === "DECLINED"));
  await showPublic(state("REVIEW", "REVIEW"));
  await page.getByRole("button", { name: "Confirmar informações", exact: true }).click();
  await page.locator("#completion-title").waitFor();
  await capture("correcao-conclusao-sem-contato", [320, 1440]);
  check("Conclusão sem contato exibida após confirmação", commercialDeclined && (await page.locator(".diagnostic-lead").innerText()).includes("contato"));
  results.publicRequests = publicRequests.map(({ endpoint, body }) => ({ endpoint, requestId: body.clientRequestId, rowVersion: body.rowVersion }));
  controls.publicHandler = null;
  console.log("Correções: contraste, drawer, cards, comandos e transições públicas verificados.");
}

export async function runNativeZoom({ chromium, routeHandler, session, origin, base, f, evidence, results, check }) {
  results.zoom = [];
  for (const factor of [2, 4]) {
    const profile = await mkdtemp(join(tmpdir(), "numora-zoom-"));
    await mkdir(join(profile, "Default"));
    // Chromium's default partition key is 'x'. This changes browser zoom, not CSS or device emulation.
    // Source: chromium/chrome/browser/ui/zoom/chrome_zoom_level_prefs.cc, GetPartitionKey.
    await writeFile(join(profile, "Default", "Preferences"), JSON.stringify({ partition: { default_zoom_level: { x: Math.log(factor) / Math.log(1.2) } } }));
    const context = await chromium.launchPersistentContext(profile, {
      headless: true, executablePath: process.env.BROWSER_EXECUTABLE, viewport: null,
      args: ["--window-size=1296,1000"],
    });
    try {
      await context.route("**/*", routeHandler);
      await context.addInitScript(session => {
        localStorage.setItem("numora.admin.auth.v1", JSON.stringify(session));
        localStorage.setItem("sb-tbioidswvkfbnyedulrg-auth-token", JSON.stringify({ ...session, user: { ...session.user, is_anonymous: true } }));
      }, session);
      const page = context.pages()[0];
      for (const [name, path] of [["site", "/"], ["identificacao", "/diagnostico/"], ["lista", "/adm/diagnosticos/"], ["workflow", `/adm/diagnostico/?id=${f.diagnosticId}#notas`]]) {
        await page.goto(`${origin}${base}${path}`);
        if (name === "identificacao") { await page.getByRole("button", { name: "Começar diagnóstico" }).click(); await page.locator("#identification-name").waitFor(); }
        if (name === "lista") await page.locator(".admin-diagnostic-card").first().waitFor();
        if (name === "workflow") { await page.getByRole("button", { name: "Prioridade", exact: true }).click(); await page.getByRole("dialog").waitFor(); }
        await page.evaluate(() => document.fonts.ready);
        const dimensions = await page.evaluate(() => ({ inner: innerWidth, outer: outerWidth, dpr: devicePixelRatio, scale: visualViewport.scale, scroll: document.documentElement.scrollWidth }));
        check(`Zoom nativo ${factor * 100}% ${name}: confirmado e sem overflow`, dimensions.dpr === factor && dimensions.scale === 1 && dimensions.inner < dimensions.outer / 1.5 && dimensions.scroll <= dimensions.inner);
        if (name === "workflow") {
          await page.locator("#workflow-reason").focus();
          check(`Zoom ${factor * 100}%: campo focado visível no diálogo`, await page.locator("#workflow-reason").evaluate(e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
          await page.keyboard.press("Escape");
          await page.getByRole("dialog").waitFor({ state: "hidden" });
        }
        const file = `zoom-${factor * 100}-${name}.png`;
        // Playwright's full-page clip uses CSS dimensions and crops native browser zoom.
        // Capture the actual physical viewport, without a CSS clip or scale override.
        const cdp = await context.newCDPSession(page);
        const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
        await writeFile(resolve(evidence, file), Buffer.from(screenshot.data, "base64"));
        await cdp.detach();
        results.zoom.push({ name, factor, ...dimensions, file });
      }
    } finally { await context.close(); }
  }
}
