import OpenAI from "openai";

const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

// Was: throw at module load if either env var was unset. This module is
// imported (transitively, at server boot) by every AI route, and every AI
// route is imported by the main router — so a missing key took down the
// ENTIRE server (deterministic astrology, tasks, onboarding, everything),
// not just AI. Construct with placeholders instead; every AI route must
// check isOpenAiConfigured before calling `openai` and return a contained
// 503 — see routes that already do this for the pattern.
export const isOpenAiConfigured = Boolean(baseURL && apiKey);

if (!isOpenAiConfigured) {
  // eslint-disable-next-line no-console
  console.error(
    "[integrations-openai-ai-server] AI_INTEGRATIONS_OPENAI_BASE_URL / AI_INTEGRATIONS_OPENAI_API_KEY not set — AI routes will 503 instead of crashing the server.",
  );
}

export const openai = new OpenAI({
  apiKey: apiKey || "unconfigured",
  baseURL: baseURL || "https://api.openai.com/v1",
});
