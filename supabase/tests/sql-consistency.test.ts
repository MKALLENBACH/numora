import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const schema = readFileSync(
  fileURLToPath(new URL("../migrations/20260805000100_diagnostic_schema.sql", import.meta.url)),
  "utf8",
);
const rpcs = readFileSync(
  fileURLToPath(new URL("../migrations/20260805000300_diagnostic_rpcs.sql", import.meta.url)),
  "utf8",
);
const interview = readFileSync(
  fileURLToPath(new URL("../functions/_shared/interview.ts", import.meta.url)),
  "utf8",
);
const handler = readFileSync(
  fileURLToPath(new URL("../functions/_shared/handler.ts", import.meta.url)),
  "utf8",
);

describe("diagnostic SQL consistency invariants", () => {
  it("persists the submitted question version with every answer", () => {
    expect(schema).toMatch(/question_version text not null/);
    expect(rpcs).toMatch(/p_question_version text/);
    expect(rpcs).toMatch(/question_code, question_version, response_type/);
    expect(interview).toMatch(/questionVersion: answer\.question_version/);
  });

  it("serializes concurrent starts for the same owner", () => {
    expect(rpcs).toMatch(
      /pg_advisory_xact_lock\([\s\S]*hashtextextended\(p_owner_user_id::text, 0\)/,
    );
  });

  it("checks the review version inside the locked update transaction", () => {
    expect(rpcs).toMatch(/p_review_version integer/);
    expect(rpcs).toMatch(
      /for update;[\s\S]*current_review\.version <> p_review_version[\s\S]*STATE_CONFLICT/,
    );
  });

  it("checks the review version inside the locked confirmation transaction", () => {
    expect(rpcs).toMatch(
      /diagnostic_confirm_review\([\s\S]*p_review_version integer[\s\S]*for update;[\s\S]*current_review\.version <> p_review_version[\s\S]*STATE_CONFLICT/,
    );
    expect(rpcs).toMatch(
      /diagnostic_confirm_review\(uuid, uuid, uuid, integer, text, text\)/,
    );
  });

  it("transitions the session to BLOCKED with a blocking answer", () => {
    expect(rpcs).toMatch(
      /update public\.diagnostic_sessions set[\s\S]*when p_next_status = 'BLOCKED' then 'BLOCKED'::public\.session_status/,
    );
  });

  it("never confirms redacted, unconfirmed or low-confidence evidence", () => {
    expect(rpcs).toMatch(
      /coalesce\(p_confirmed, false\)[\s\S]*not p_redacted[\s\S]*sourceType'\) <> 'NOT_CONFIRMED'[\s\S]*confidence'\)::numeric >= 0\.6/,
    );
  });
  it("only projects high-confidence confirmed extraction fields", () => {
    expect(handler).toMatch(
      /acceptedFields = extractedFields\.filter[\s\S]*confidence >= 0\.85[\s\S]*AI_INFERENCE[\s\S]*NOT_CONFIRMED/,
    );
  });
  it("rebuilds confirmed normalized fields without reviving an empty low-confidence projection", () => {
    expect(interview).toMatch(
      /normalizedProjection[\s\S]*Object\.entries\(normalizedProjection \?\? \{\}\)[\s\S]*setValueAtPath\(data, path, value\)/,
    );
    expect(interview).toMatch(
      /!hasNormalizedProjection && primaryPath[\s\S]*setValueAtPath\(data, primaryPath, answer\.raw_value\)/,
    );
    expect(interview).toMatch(
      /input\.normalizedFields !== undefined[\s\S]*Object\.entries\(input\.normalizedFields\)[\s\S]*setValueAtPath\(data, path, value\)/,
    );
  });
  it("treats unknown sentinels as missing critical information", () => {
    expect(interview).toMatch(
      /"unknown" in value && value\.unknown === true\) return false/,
    );
  });
});
