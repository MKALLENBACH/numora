// Run with tsx against the static preview. All external requests are intercepted.
// The synthetic database lives only in memory; this script never contacts Supabase.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createWorkflowDb, workflowFixture } from "../tests/admin-workflow/database.ts";
import { resolveAdminEffectiveData } from "../supabase/functions/_shared/admin-effective-data.ts";
import { buildAdminArtifact } from "../supabase/functions/_shared/admin-workflow-artifacts.ts";
import { GENERATED_INTERVIEW_CATALOG } from "../supabase/functions/_shared/generated/question-catalog.ts";
import { PublicDiagnosticStateSchema } from "../src/features/diagnostic/contracts/public.ts";
import { AdminWorkflowCommandSchema } from "../supabase/functions/_shared/admin-workflow-contract.ts";
import { runFinalCorrections, runNativeZoom } from "./check-final-corrections.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = "http://127.0.0.1:3000";
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "/numora";
const evidence = resolve(process.env.VISUAL_EVIDENCE_DIR || "docs/evidencias/refinamento-visual");
await mkdir(evidence, { recursive: true });
const results = { widths: [320, 390, 768, 900, 901, 1024, 1440], screens: [], checks: [], errors: [], externalRequestsForwarded: 0, accessibility: [], commands: [] };
const db = await createWorkflowDb();
const f = await workflowFixture(db);
const query = async (sql, args) => (await db.query(sql, args)).rows[0].value;
async function seedCommand(command, payload = {}, artifact = null) {
  const versions = (await db.query("select r.row_version review,d.row_version diagnostic from public.diagnostics d join public.diagnostic_review_states r on r.diagnostic_id=d.id where d.id=$1", [f.diagnosticId])).rows[0];
  return query("select public.admin_apply_diagnostic_command($1,$2::jsonb,$3::jsonb) value", [f.admin, JSON.stringify({ command, payload, diagnosticId: f.diagnosticId, clientRequestId: crypto.randomUUID(), expectedReviewVersion: Number(versions.review), expectedDiagnosticVersion: Number(versions.diagnostic) }), JSON.stringify(artifact)]);
}
await seedCommand("ADD_NOTE", { category: "GENERAL", body: "Fixture de revisão visual: texto sintético para verificar notas, autoria, data e leitura no celular." });
for (const command of ["RECALCULATE_QUALIFICATION", "REGENERATE_BRIEFING"]) {
  const prepared = (await db.query("select s source,public.admin_workflow_request_hash(s) fingerprint from (select public.admin_workflow_source($1) s) x", [f.diagnosticId])).rows[0];
  await seedCommand(command, {}, await buildAdminArtifact(prepared.source, prepared.fingerprint, command));
}
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
let role = "ADMIN";
let publicState;
let publicFailure = false;
let failNextAnswer = false;
let adminFailure = false;
const controls = { commandMode: "conflict", releaseCommand: null, publicHandler: null, listTransform: null };
const now = new Date().toISOString();
const stages = ["IDENTIFICATION", "CHALLENGE", "CURRENT_PROCESS", "IMPACT", "BUYING_CONTEXT", "REVIEW"];
const stageLabels = ["Identificação", "Desafio", "Processo", "Impacto", "Contexto", "Revisão"];
const session = { access_token: "local-visual-fixture", refresh_token: "local-fixture", expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user: { id: f.admin, aud: "authenticated", role: "authenticated", email: "fixture@example.invalid", is_anonymous: false, app_metadata: {}, user_metadata: {}, created_at: now } };
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(({ session }) => {
  localStorage.setItem("numora.admin.auth.v1", JSON.stringify(session));
  localStorage.setItem("sb-tbioidswvkfbnyedulrg-auth-token", JSON.stringify({ ...session, user: { ...session.user, is_anonymous: true } }));
}, { session });
const routeHandler = async route => {
  const url = new URL(route.request().url());
  if (url.origin === origin) return route.continue();
  const body = route.request().postDataJSON() ?? {};
  let data = null;
  let error = null;
  let status = 200;
  const actor = role === "VIEWER" ? f.viewer : role === "CONSULTANT" ? f.consultant : f.admin;
  const endpoint = url.pathname.split("/").at(-1);
  if (url.pathname.startsWith("/auth/v1/")) {
    data = url.pathname.endsWith("/user") ? session.user : session;
    return route.fulfill({ status: 200, json: data });
  }
  try {
    if (endpoint === "admin-auth") data = { userId: actor, profileId: role === "VIEWER" ? f.vp : role === "CONSULTANT" ? f.cp : f.ap, displayName: `Revisão visual · ${role}`, email: "fixture@example.invalid", role, isActive: true };
    else if (endpoint === "admin-diagnostics-list") {
      if (adminFailure) throw new Error("Falha de consulta simulada");
      data = await query("select public.admin_list_diagnostics($1::jsonb) value", [JSON.stringify(body)]);
      if (controls.listTransform) data = controls.listTransform(data);
    } else if (endpoint === "admin-diagnostic-detail") data = await query("select public.admin_get_diagnostic_detail_v4($1,$2,$3) value", [actor, f.diagnosticId, body.section]);
    else if (endpoint === "admin-diagnostic-workflow") {
      if (body.operation === "READ") {
        const raw = await query("select public.admin_read_workflow($1,$2) value", [actor, f.diagnosticId]);
        const { source, ...safe } = raw;
        data = { ...safe, fields: raw.workflow.privacyRestricted ? [] : resolveAdminEffectiveData(source).fields };
      } else if (body.operation === "HISTORY") data = await query("select public.admin_read_workflow_history($1,$2,$3) value", [actor, f.diagnosticId, body.kind]);
      else if (body.operation === "LIST_ASSIGNEES") data = [{ id: f.ap, display_name: "Admin fixture", role: "ADMIN", is_active: true }];
      else if (controls.commandMode === "conflict") { status = 409; error = { code: "STATE_CONFLICT", message: "Conflito simulado: recarregue os dados." }; }
      else {
        const command = AdminWorkflowCommandSchema.parse(body);
        results.commands.push({ role, command: command.command, clientRequestId: command.clientRequestId });
        if (controls.commandMode === "held") await new Promise(resolve => { controls.releaseCommand = resolve; });
        if (controls.commandMode === "failure") throw new Error("Falha de operação simulada");
        let artifact = null;
        if (["RECALCULATE_QUALIFICATION", "REGENERATE_BRIEFING"].includes(command.command)) {
          const prepared = (await db.query("select s source,public.admin_workflow_request_hash(s) fingerprint from (select public.admin_workflow_source($1) s) x", [f.diagnosticId])).rows[0];
          artifact = await buildAdminArtifact(prepared.source, prepared.fingerprint, command.command);
        }
        data = await query("select public.admin_apply_diagnostic_command($1,$2::jsonb,$3::jsonb) value", [actor, JSON.stringify(command), JSON.stringify(artifact)]);
      }
    } else if (endpoint === "diagnostic-state" && !publicState) { status = 404; error = { code: "SESSION_NOT_FOUND" }; }
    else if (endpoint.startsWith("diagnostic-")) {
      if (publicFailure || (endpoint === "diagnostic-submit-answer" && failNextAnswer)) { failNextAnswer = false; status = 503; error = { code: "PERSISTENCE_UNAVAILABLE" }; }
      else if (controls.publicHandler) {
        const response = await controls.publicHandler(endpoint, body, publicState);
        if (response.error) { status = response.status; error = response.error; }
        else { publicState = response.state; data = publicState; }
      } else data = publicState;
    } else { status = 403; error = { code: "ACCESS_DENIED", message: "External request blocked by visual test." }; }
  } catch (failure) { status = 503; error = { code: "BACKEND_FAILURE", message: failure.message }; console.log(`Fixture ${endpoint}: ${failure.message}`); }
  await route.fulfill({ status, json: { data, error, meta: { rowVersion: 1 } } });
};
await context.route("**/*", routeHandler);
const page = await context.newPage();
page.on("pageerror", error => results.errors.push(error.message));
const check = (name, value) => { assert.ok(value, name); results.checks.push(name); };
async function capture(name, widths = results.widths, target = page) {
  for (const width of widths) {
    await target.setViewportSize({ width, height: width < 500 ? 844 : 900 });
    await target.evaluate(() => document.fonts.ready);
    const dimensions = await target.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, height: document.body.scrollHeight }));
    if (dimensions.scrollWidth > width) {
      await target.screenshot({ path: resolve(evidence, `overflow-${name}-${width}.png`), fullPage: true });
      console.log(await target.evaluate(() => [...document.querySelectorAll("body *")].filter(e => e.getBoundingClientRect().right > innerWidth && e.getBoundingClientRect().width > 0).map(e => ({ tag: e.tagName, class: e.className, width: e.getBoundingClientRect().width, right: e.getBoundingClientRect().right })).slice(0, 20)));
    }
    check(`${name} ${width}px sem overflow horizontal`, dimensions.scrollWidth <= width);
    const file = `${name}-${width}.png`;
    await target.screenshot({ path: resolve(evidence, file), fullPage: true });
    results.screens.push({ name, ...dimensions, file });
    if (process.env.AXE_PATH && [320, 1440].includes(width)) {
      await target.addScriptTag({ path: process.env.AXE_PATH });
      const audit = await target.evaluate(async () => {
        const result = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } });
        return { violations: result.violations, incomplete: result.incomplete.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) })) };
      });
      results.accessibility.push({ name, width, ...audit });
      check(`${name} ${width}px sem violações axe AA detectadas`, audit.violations.length === 0);
    }
  }
  console.log(`${name}: ${widths.length} larguras verificadas`);
}
function state(stage, status = "IN_PROGRESS", question = null) {
  const index = Math.max(0, stages.indexOf(stage));
  return PublicDiagnosticStateSchema.parse({ diagnosticId: f.diagnosticId, sessionId: f.sessionId, stage, status, currentQuestion: question, review: stage === "REVIEW" ? { version: 1, company: "Empresa fixture", affectedArea: "Financeiro", challenge: "Retrabalho no processo financeiro (fixture visual).", currentProcess: "Conferência manual de documentos.", participants: "Equipe de operações", systems: ["Planilha"], mainImpacts: ["Retrabalho"], desiredOutcome: "Melhorar a visibilidade do processo", priority: "Alta", deadline: null, decisionContext: "Análise interna", confirmed: false } : null, progress: { currentStep: index + 1, totalSteps: 6, currentLabel: stageLabels[index], steps: stages.map((id, i) => ({ id, label: stageLabels[i], status: i < index ? "COMPLETED" : i === index ? "CURRENT" : "UPCOMING" })) }, canGoBack: true, canResume: false, saveStatus: "SAVED" });
}
async function showPublic(next) {
  publicState = next;
  await page.goto(`${origin}${base}/diagnostico/`);
  if (["COMPLETED", "COMPLETED_NO_CONTACT", "BLOCKED"].includes(next.status)) {
    await page.locator(next.status === "BLOCKED" ? "#blocked-title" : "#completion-title").waitFor();
  } else await page.getByRole("button", { name: "Começar diagnóstico" }).click();
  await page.locator(".diagnostic-card h1").waitFor();
  await page.waitForFunction(() => document.activeElement?.tagName === "H1");
}
try {
  if (!process.env.CORRECTIONS_ONLY) {
  if (!process.env.VISUAL_ADMIN_ONLY) {
  await page.goto(`${origin}${base}/`);
  check("Oito seções principais", await page.locator("main > section").count() === 8);
  for (const id of ["inicio", "posicionamento", "desafios", "jornada", "atuacao", "como-trabalhamos", "entregaveis", "criterios", "diferenciais", "clientes", "manifesto", "diagnostico"]) check(`Âncora ${id}`, await page.locator(`#${id}`).count() === 1);
  check("CTA preserva destino com basePath", (await page.locator(".hero__actions a").first().getAttribute("href")) === `${base}/diagnostico`);
  check("Fonte local Inter carregada", await page.evaluate(() => [...document.fonts].some(font => /inter/i.test(font.family) && font.status === "loaded")));
  await page.locator(".hero__actions a").first().focus();
  check("Foco visível do CTA", await page.locator(".hero__actions a").first().evaluate(e => getComputedStyle(e).outlineWidth === "3px"));
  await capture("depois-site");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}${base}/`);
  check("CTA visível no primeiro viewport móvel", (await page.locator(".hero__actions a").first().boundingBox()).y < 844);
  await page.getByRole("button", { name: /menu/i }).click();
  check("Menu público abre", await page.locator(".menu-toggle").getAttribute("aria-expanded") === "true");
  await page.keyboard.press("Escape");
  check("Escape fecha menu público", await page.locator(".menu-toggle").getAttribute("aria-expanded") === "false");
  await page.emulateMedia({ reducedMotion: "reduce" });
  check("Reduced motion remove rolagem suave", await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior === "auto"));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const [name, path] of [["diagnostico-intro", "/diagnostico/"], ["privacidade", "/politica-de-privacidade/"], ["recuperacao", "/adm/recuperar-acesso/"]]) {
    await page.goto(`${origin}${base}${path}`);
    await capture(`depois-${name}`);
  }
  await showPublic(state("PRIVACY_CONSENT"));
  check("Consentimento sem pré-seleção", !await page.getByRole("checkbox").isChecked());
  check("Continuar depende do consentimento", await page.getByRole("button", { name: "Continuar", exact: true }).isDisabled());
  await capture("depois-consentimento", [320, 1440]);
  await showPublic(state("COMMERCIAL_CONSENT"));
  check("Contato sem pré-seleção", await page.locator('input[type="radio"]:checked').count() === 0);
  await page.getByLabel("Não autorizo", { exact: true }).check();
  check("Conclusão sem contato continua disponível", await page.getByRole("button", { name: "Continuar", exact: true }).isEnabled());
  await showPublic(state("IDENTIFICATION"));
  await capture("depois-identificacao");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  check("Validação foca primeiro campo obrigatório", await page.locator("#identification-name").evaluate(e => e === document.activeElement));
  await page.locator("#identification-name").fill("Rascunho fixture");
  await page.locator("#identification-role").focus();
  publicState = { ...publicState, canResume: true };
  await page.reload();
  await page.getByRole("button", { name: "Começar diagnóstico" }).click();
  await page.getByRole("button", { name: "Continuar diagnóstico", exact: true }).click();
  check("Rascunho da identificação preservado", await page.locator("#identification-name").inputValue() === "Rascunho fixture");
  const types = [...new Set(GENERATED_INTERVIEW_CATALOG.questions.map(q => q.responseType))];
  for (const type of types) {
    const q = GENERATED_INTERVIEW_CATALOG.questions.find(q => q.responseType === type);
    const question = Object.fromEntries(Object.entries(q).filter(([key]) => ["id", "version", "stage", "text", "responseType", "required", "options", "validation"].includes(key)));
    await showPublic(state(q.stage, "IN_PROGRESS", question));
    await capture(`depois-pergunta-${type.toLowerCase()}`, [320, 1440]);
    check(`Foco na pergunta ${type}`, await page.locator("#question-title").evaluate(e => e === document.activeElement));
  }
  const q = GENERATED_INTERVIEW_CATALOG.questions[0];
  const question = Object.fromEntries(Object.entries(q).filter(([key]) => ["id", "version", "stage", "text", "responseType", "required", "validation"].includes(key)));
  await showPublic(state("CHALLENGE", "IN_PROGRESS", question));
  await page.locator("textarea").fill("Rascunho visual suficiente para validar a preservação após uma falha.");
  failNextAnswer = true;
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.locator(".diagnostic-card--error").waitFor();
  await capture("depois-erro-diagnostico", [320, 1440]);
  check("Rascunho mantido após falha", await page.evaluate(() => localStorage.getItem("numora.diagnostic.draft.v1")?.includes("Rascunho visual suficiente")));
  await showPublic(state("REVIEW", "REVIEW"));
  await capture("depois-revisao", [320, 390, 768, 1440]);
  await page.getByRole("button", { name: "Editar Empresa", exact: true }).click();
  await capture("depois-dialogo-revisao", [320, 1440]);
  await page.keyboard.press("Escape");
  check("Diálogo de revisão devolve foco ao botão Editar", await page.getByRole("button", { name: "Editar Empresa", exact: true }).evaluate(e => e === document.activeElement));
  for (const status of ["COMPLETED", "COMPLETED_NO_CONTACT", "BLOCKED"]) {
    await showPublic(state(status === "BLOCKED" ? "PRIVACY_CONSENT" : "COMPLETION", status));
    await capture(`depois-${status.toLowerCase()}`, [320, 1440]);
  }
  }
  const loginContext = await browser.newContext();
  await loginContext.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.fulfill({ status: 401, json: { error: "fixture login error" } }));
  const loginPage = await loginContext.newPage();
  await loginPage.goto(`${origin}${base}/adm/login/`);
  await loginPage.getByRole("heading", { name: /Acesse/ }).waitFor();
  await capture("depois-login", results.widths, loginPage);
  await loginPage.getByLabel(/E-mail/).fill("fixture@example.invalid");
  await loginPage.getByLabel(/Senha/, { exact: true }).fill("fixture-only-password");
  await loginPage.getByRole("button", { name: /Entrar|Acessar/ }).click();
  await loginPage.locator(".admin-error[role=alert]").waitFor();
  await capture("depois-login-erro", [320, 1440], loginPage);
  await loginContext.close();
  for (const [name, path] of [["adm-entrada", "/adm/"], ["adm-lista", "/adm/diagnosticos/"]]) {
    await page.goto(`${origin}${base}${path}`);
    await page.locator(".admin-page h1").waitFor();
    await capture(`depois-${name}`);
  }
  check("Navegação indica o módulo atual", await page.locator('.admin-sidebar .admin-nav a[aria-current="page"]').textContent() === "Diagnósticos");
  await page.getByRole("button", { name: /Filtros/ }).click();
  await capture("depois-adm-filtros", [320, 900, 1440]);
  await page.keyboard.press("Escape");
  adminFailure = true;
  await page.reload();
  await page.getByRole("button", { name: /Tentar novamente/ }).waitFor();
  await capture("depois-adm-erro", [320, 1440]);
  adminFailure = false;
  const detailUrl = `${origin}${base}/adm/diagnostico/?id=${f.diagnosticId}`;
  for (const tab of ["visao-geral", "entrevista", "qualificacao", "flags", "briefing", "notas", "auditoria"]) {
    await page.goto(`${detailUrl}#${tab}`);
    await page.locator(".admin-workflow-summary h2").waitFor();
    await page.locator(`[role=tab][aria-selected=true]`).waitFor();
    await page.waitForFunction(() => !document.querySelector(".admin-detail-tabpanel .admin-loading"));
    await capture(`depois-adm-${tab}`, tab === "entrevista" ? results.widths : [320, 1440]);
  }
  await page.goto(`${detailUrl}#entrevista`);
  await page.getByRole("button", { name: "Corrigir dado estruturado", exact: true }).waitFor();
  await page.getByRole("button", { name: "Corrigir dado estruturado", exact: true }).click();
  await capture("depois-adm-correcao", [320, 1440]);
  await page.keyboard.press("Escape");
  check("Diálogo administrativo devolve foco", await page.getByRole("button", { name: "Corrigir dado estruturado", exact: true }).evaluate(e => e === document.activeElement));
  await page.getByRole("button", { name: "Alterar status", exact: true }).click();
  await capture("depois-adm-status", [320, 1440]);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 900, height: 900 });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  check("Menu ADM abre em 900px", await page.getByRole("dialog", { name: "Menu do ADM" }).isVisible());
  await page.keyboard.press("Escape");
  check("Menu ADM devolve foco", await page.getByRole("button", { name: "Menu", exact: true }).evaluate(e => e === document.activeElement));
  await page.getByRole("tab", { name: "Entrevista", exact: true }).focus();
  await page.keyboard.press("End");
  check("Teclado End foca última aba", await page.getByRole("tab", { name: "Notas internas", exact: true }).evaluate(e => e === document.activeElement));
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.getElementById("admin-tab-notas")?.getAttribute("aria-selected") === "true");
  check("Teclado End seleciona última aba", await page.getByRole("tab", { name: "Notas internas", exact: true }).getAttribute("aria-selected") === "true");
  for (const nextRole of ["CONSULTANT", "VIEWER"]) {
    role = nextRole;
    await page.goto(`${detailUrl}#entrevista`);
    await page.reload();
    await page.locator(".admin-workflow-summary h2").waitFor();
    await page.locator(".admin-workflow-effective").waitFor();
    if (role === "VIEWER") check("Viewer não recebe controles de escrita", await page.getByRole("button", { name: /Assumir diagnóstico|Alterar status|Prioridade|Corrigir dado estruturado/ }).count() === 0);
    else check("Consultor mantém ação permitida", await page.getByRole("button", { name: "Assumir diagnóstico", exact: true }).count() === 1);
    await capture(`depois-adm-${role.toLowerCase()}`, [320, 1440]);
  }
  }
  if (process.env.FINAL_CORRECTION_QA) await runFinalCorrections({ page, context, db, f, query, check, capture, results, controls, showPublic, state, origin, base, setRole: next => { role = next; } });
  if (process.env.FINAL_CORRECTION_QA) {
    role = "ADMIN";
    await showPublic(state("IDENTIFICATION"));
    await runNativeZoom({ chromium, routeHandler, session, origin, base, f, evidence, results, check });
  }
  check("Sem erros JavaScript", results.errors.length === 0);
} catch (failure) {
  results.failure = failure.message;
  await page.screenshot({ path: resolve(evidence, "failure.png"), fullPage: true });
  await writeFile(resolve(evidence, "failure.txt"), await page.locator("body").innerText());
  throw failure;
} finally {
  await writeFile(resolve(evidence, "resultados.json"), JSON.stringify(results, null, 2));
  await browser.close();
  await db.close();
}
console.log(`${results.checks.length} verificações passaram; ${results.screens.length} screenshots. Nenhuma chamada externa encaminhada.`);
