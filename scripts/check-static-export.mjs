import assert from "node:assert/strict";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
const root = resolve("out");
const files = await readdir(root, { recursive: true });
const checked = new Set();
for (const file of files.filter(file => file.endsWith(".html") || file.endsWith(".css"))) {
  const content = await readFile(resolve(root, file), "utf8");
  const references = file.endsWith(".html")
    ? [...content.matchAll(/(?:href|src)="([^"<>]+)"/g)].map(match => match[1])
    : [...content.matchAll(/url\(["']?([^\s"')]+)["']?\)/g)].map(match => match[1]);
  for (const reference of references) {
    if (!reference.startsWith("/")) continue;
    assert.ok(!base || reference === base || reference.startsWith(`${base}/`), `${file}: missing basePath in ${reference}`);
    const path = decodeURIComponent(new URL(reference, "http://localhost").pathname).slice(base.length);
    const target = resolve(root, `.${path}`);
    assert.ok(target.startsWith(root), "Reference stays inside export");
    const info = await stat(target);
    if (info.isDirectory()) await stat(resolve(target, "index.html"));
    checked.add(reference);
  }
}
const home = await readFile(resolve(root, "index.html"), "utf8");
assert.ok(home.includes(`href="${base}/diagnostico"`), "CTA destination");
assert.ok(home.includes("Resolva o seu problema agora!"), "CTA copy");
assert.ok(files.some(file => file.endsWith(".woff2")), "Local font exported");
for (const route of ["diagnostico", "politica-de-privacidade", "adm", "adm/diagnosticos", "adm/diagnostico", "adm/perfil", "adm/login", "adm/recuperar-acesso"]) await stat(resolve(root, route, "index.html"));
const result = { basePath: base, localReferencesChecked: checked.size, routes: 9, localWoff2: true, cta: true, success: true };
if (process.env.STATIC_EVIDENCE_FILE) await writeFile(process.env.STATIC_EVIDENCE_FILE, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
