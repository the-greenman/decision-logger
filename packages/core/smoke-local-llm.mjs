// Smoke test for the local LLM path used by VercelAILLMService.generateDraft.
// Runs the same `generateObject` call pattern against whichever provider
// LLM_PROVIDER/LLM_MODEL/LLM_BASE_URL point at. Prints the structured result.
//
// Usage (from repo root):
//   LLM_PROVIDER=ollama LLM_MODEL=gpt-oss:20b \
//   LLM_BASE_URL=http://localhost:11434/v1 \
//   node scripts/smoke-local-llm.mjs

import { generateObject } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "@repo/schema";

const provider = process.env.LLM_PROVIDER ?? "ollama";
const modelId = process.env.LLM_MODEL ?? "gpt-oss:20b";
const baseURL = process.env.LLM_BASE_URL ?? "http://localhost:11434/v1";
const apiKey = process.env.LLM_API_KEY ?? "not-needed";

console.log(`[smoke] provider=${provider} model=${modelId} baseURL=${baseURL}`);

const local = createOpenAICompatible({
  name: provider,
  baseURL,
  apiKey,
  supportsStructuredOutputs: true,
});
const model = local(modelId);

const schema = z.object({
  decision: z.string().describe("One-sentence summary of the decision."),
  rationale: z.string().describe("Why this decision was made."),
  suggestedTags: z.array(z.string()).describe("3-5 short lowercase tags."),
});

const prompt = `You are recording a meeting decision. Given the transcript snippet below, fill the schema.

Transcript:
Alice: We have to pick a database for the new service. Speed matters more than anything.
Bob: Postgres is the obvious choice — we already run it everywhere.
Alice: Agreed. Let's standardise on Postgres 16.
Bob: Good, I'll update the infra docs.`;

const t0 = Date.now();
try {
  const { object, usage } = await generateObject({ model, schema, prompt });
  const ms = Date.now() - t0;
  console.log(`[smoke] OK in ${ms}ms`);
  console.log("[smoke] object =", JSON.stringify(object, null, 2));
  if (usage) console.log("[smoke] usage =", usage);
} catch (err) {
  console.error(`[smoke] FAILED after ${Date.now() - t0}ms`);
  console.error(err);
  process.exit(1);
}
