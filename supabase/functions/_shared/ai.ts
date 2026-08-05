import { z } from "zod";
import { minimizeReviewForProvider } from "./review-privacy.ts";

export { minimizeReviewForProvider } from "./review-privacy.ts";

const ReviewSchema = z.object({
  company: z.string().max(200),
  affectedArea: z.string().max(100),
  challenge: z.string().max(800),
  currentProcess: z.string().max(1200),
  participants: z.string().max(500),
  systems: z.array(z.string().max(100)).max(20),
  mainImpacts: z.array(z.string().max(200)).max(15),
  desiredOutcome: z.string().max(800),
  priority: z.string().max(100),
  deadline: z.string().max(300).nullable(),
  decisionContext: z.string().max(800),
}).strict();

export type GeneratedReview = z.infer<typeof ReviewSchema>;

const SYSTEM_INSTRUCTION = `Você é um componente auxiliar de redação.
Você não conduz a entrevista. Você não toma decisões comerciais. Você não define score.
Você não inventa fatos. Você não transforma inferência em fato.
Você preserva o significado do rascunho e retorna somente JSON conforme o schema fornecido.`;

async function externalReview(fallback: GeneratedReview): Promise<GeneratedReview> {
  if ((Deno.env.get("AI_ALLOW_EXTERNAL_OPERATIONAL_DATA") ?? "false").toLowerCase() !== "true") {
    throw new Error("AI_EXTERNAL_DATA_NOT_APPROVED");
  }
  const apiUrl = Deno.env.get("AI_API_URL");
  const apiKey = Deno.env.get("AI_API_KEY");
  const model = Deno.env.get("AI_MODEL");
  if (!apiUrl || !apiKey || !model) throw new Error("AI_NOT_CONFIGURED");
  const timeoutMs = Math.min(Math.max(Number(Deno.env.get("AI_TIMEOUT_MS") ?? 8000), 1000), 15000);
  const retries = Math.min(Math.max(Number(Deno.env.get("AI_MAX_RETRIES") ?? 1), 0), 1);
  const providerDraft = minimizeReviewForProvider(fallback);
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        signal: controller.signal,
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_INSTRUCTION },
            { role: "user", content: JSON.stringify({ task: "Revise o resumo sem adicionar fatos.", draft: providerDraft }) },
          ],
        }),
      });
      if (!response.ok) throw new Error("AI_PROVIDER_UNAVAILABLE");
      const payload = await response.json();
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("AI_INVALID_RESPONSE");
      const reviewed = ReviewSchema.parse(JSON.parse(content));
      return {
        ...reviewed,
        company: fallback.company,
        participants: fallback.participants,
        decisionContext: fallback.decisionContext,
      };
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

export async function reviseReview(fallback: GeneratedReview): Promise<{
  review: GeneratedReview;
  mode: "deterministic" | "mock" | "external";
  fallbackUsed: boolean;
}> {
  const validatedFallback = ReviewSchema.parse(fallback);
  const enabled = (Deno.env.get("AI_ENABLED") ?? "false").toLowerCase() === "true";
  const provider = (Deno.env.get("AI_PROVIDER") ?? "deterministic").toLowerCase();
  if (!enabled || provider === "deterministic") {
    return { review: validatedFallback, mode: "deterministic", fallbackUsed: false };
  }
  if (provider === "mock") return { review: validatedFallback, mode: "mock", fallbackUsed: false };
  try {
    return { review: await externalReview(validatedFallback), mode: "external", fallbackUsed: false };
  } catch {
    return { review: validatedFallback, mode: "deterministic", fallbackUsed: true };
  }
}
