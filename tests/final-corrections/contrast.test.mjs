import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

export function contrast(a, b) {
  const luminance = hex => {
    const rgb = hex.replace("#", "").match(/../g).map(value => parseInt(value, 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("semantic link meets AA on the actual light surfaces without changing the brand", async () => {
  const tokens = await readFile(new URL("../../src/styles/tokens.css", import.meta.url), "utf8");
  const diagnostic = await readFile(new URL("../../src/app/diagnostico/diagnostic.css", import.meta.url), "utf8");
  const token = name => tokens.match(new RegExp(`--${name}:\\s*(#[a-f0-9]{6})`, "i"))[1];
  assert.equal(token("midnight"), "#0b1f33");
  assert.equal(token("cyan"), "#3dd9eb");
  const backgrounds = [token("white"), token("neutral")];
  for (const selector of [".diagnostic-progress__step.is-complete .diagnostic-progress__marker", ".diagnostic-choice:has(input:checked)", ".diagnostic-completion-mark"]) {
    const block = diagnostic.slice(diagnostic.indexOf(selector)).split("}")[0];
    // The completion class may evolve; the assertion then requires updating the audited consumer.
    assert.ok(diagnostic.includes(selector), `Consumer exists: ${selector}`);
    backgrounds.push(block.match(/background:\s*(#[a-f0-9]{6})/i)[1]);
  }
  for (const background of backgrounds) {
    const ratio = contrast(token("link"), background);
    assert.ok(ratio >= 4.5, `${token("link")} on ${background}: ${ratio.toFixed(4)}:1`);
  }
  assert.ok(contrast(token("cyan"), token("midnight")) >= 4.5, "Inverse eyebrow on navy");
  assert.ok(contrast("#087f92", token("neutral")) < 4.5, "Regression fixture reproduces NC-01");
});
