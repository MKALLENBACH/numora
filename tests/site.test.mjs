import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const outputFile = join(root, "out", "index.html");
const html = readFileSync(outputFile, "utf8");
const source = readFileSync(join(root, "src", "app", "page.tsx"), "utf8");
const headerSource = readFileSync(
  join(root, "src", "components", "layout", "Header.tsx"),
  "utf8",
);
const diagnosticSource = readFileSync(
  join(root, "src", "components", "ui", "DiagnosticExperience.tsx"),
  "utf8",
);
const styles = ["base.css", "layout.css", "components.css", "sections.css", "responsive.css"]
  .map((file) => readFileSync(join(root, "src", "styles", file), "utf8"))
  .join("\n");

const requiredSectionIds = [
  "inicio",
  "posicionamento",
  "desafios",
  "jornada",
  "atuacao",
  "como-trabalhamos",
  "entregaveis",
  "criterios",
  "diferenciais",
  "clientes",
  "manifesto",
  "diagnostico",
];

test("a página exportada contém a estrutura institucional completa", () => {
  for (const id of requiredSectionIds) {
    assert.match(html, new RegExp(`<section[^>]+id=["']${id}["']`));
  }
  assert.equal((html.match(/<h1(?:\s|>)/g) ?? []).length, 1);
});

test("links internos apontam para identificadores existentes", () => {
  const ids = new Set([...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]));
  const fragments = [...html.matchAll(/href=["']#([^"']+)["']/g)].map((match) => match[1]);

  assert.ok(fragments.length > 0);
  for (const fragment of fragments) assert.ok(ids.has(fragment), `#${fragment} não existe`);
});

test("header implementa estado ativo acessível e menu com Escape", () => {
  assert.match(headerSource, /aria-current=/);
  assert.match(headerSource, /event\.key === "Escape"/);
  assert.match(headerSource, /menuButtonRef\.current\?\.focus\(\)/);
});

test("CTA ativo e desativado compartilham uma configuração central", () => {
  assert.match(diagnosticSource, /if \(diagnosticConfig\.enabled\)/);
  assert.match(diagnosticSource, /href=\{diagnosticConfig\.href\}/);
  assert.match(diagnosticSource, /!diagnosticConfig\.enabled/);
  assert.doesNotMatch(diagnosticSource, /window\.location/);
});

test("modal trata Escape, fechamento e retorno de foco", () => {
  assert.match(diagnosticSource, /event\.key !== "Escape"/);
  assert.match(diagnosticSource, /onCancel=/);
  assert.match(diagnosticSource, /onClose=\{restoreFocus\}/);
  assert.match(diagnosticSource, /opener\?\.isConnected/);
});

test("metadados e conteúdo estratégico essenciais permanecem exatos", () => {
  assert.match(html, /NUMORA — Transformação Operacional Inteligente/);
  assert.match(html, /Operações melhores\./);
  assert.match(html, /Resultados mensuráveis\./);
  assert.match(
    html,
    /Transformação operacional por meio de estratégia, Inteligência Artificial, automação e integração\./,
  );
  assert.match(source, /Não vendemos software\. Entregamos transformação operacional\./);
  assert.match(
    source,
    /Inteligência Artificial, automação e integração, sempre começando pelo/,
  );
  assert.match(source, /A composição de cada projeto depende do contexto/);
});

test("logos e ícones da marca são exportados nos formatos corretos", () => {
  for (const asset of [
    "logo-wordmark.png",
    "favicon.png",
    "favicon-32.png",
    "favicon-16.png",
    "apple-touch-icon.png",
  ]) {
    assert.equal(existsSync(join(root, "out", "brand", asset)), true, `${asset} não foi exportado`);
  }

  assert.match(html, /brand\/logo-wordmark\.png/);
  assert.match(html, /brand\/favicon-16\.png/);
  assert.match(html, /brand\/favicon-32\.png/);
  assert.match(html, /brand\/apple-touch-icon\.png/);
});

test("rota de diagnóstico é exportada em modo de validação, sem expor áreas privadas", () => {
  for (const route of ["adm", "private"]) {
    assert.equal(existsSync(join(root, "out", route)), false, `rota /${route} não deveria existir`);
  }

  const diagnosticHtmlPath = join(root, "out", "diagnostico", "index.html");
  assert.equal(existsSync(diagnosticHtmlPath), true, "a rota /diagnostico deve ser exportada");

  const diagnosticHtml = readFileSync(diagnosticHtmlPath, "utf8");
  assert.match(diagnosticHtml, /Diagnóstico Inicial/);
  assert.doesNotMatch(diagnosticHtml, /Fundação Estratégica — Documento Mestre/i);
});

test("documento privado não foi alterado nem exportado", () => {
  const privateFile = join(root, "private", "adm", "fundacao-estrategica", "index.html");
  const digest = createHash("sha256").update(readFileSync(privateFile)).digest("hex").toUpperCase();
  assert.equal(digest, "80A05143B73E2D11A82C908DFEB3EFC035017DB388A1EDCEB04AAC89D0ABBC0C");
  assert.doesNotMatch(html, /Fundação Estratégica — Documento Mestre/i);
});

test("base path configurado é preservado nos assets", () => {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH;
  if (!basePath) return;

  assert.match(html, new RegExp(`${basePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/_next/`));
  assert.match(
    html,
    new RegExp(
      `${basePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/brand/logo-wordmark\\.png`,
    ),
  );
});

test("CSS não mascara overflow e mantém alvos interativos mínimos", () => {
  assert.doesNotMatch(styles, /body\s*\{[^}]*overflow-x:\s*hidden/s);
  assert.match(styles, /min-height:\s*2\.75rem/);
});
