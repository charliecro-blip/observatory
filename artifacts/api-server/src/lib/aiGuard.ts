/**
 * Is the AI actually available, and what should a route do when it isn't?
 *
 * `isOpenAiConfigured` has been exported since the boot-crash fix with a
 * comment telling "every AI route" to check it and return a 503. Grepped
 * 2026-07-31: zero routes did, and the example the comment pointed at did not
 * exist. But auditing the eight call sites showed the instruction was wrong
 * for most of them, which is why it stayed unfollowed:
 *
 *   · associate, chart/explicate and planning/breakdown already fall back to a
 *     DETERMINISTIC answer when the model fails. For those, a 503 would remove
 *     a working feature — the fallback is the better answer, and the guard's
 *     only job is to reach it without a doomed round trip first.
 *   · advise and openai/messages stream, and already emit a contained
 *     error frame the client renders. Changing their response shape for a
 *     configuration that production doesn't have would be churn with real
 *     regression risk.
 *   · blueprint/generate has no fallback and reports a 500, which is the one
 *     place a plain 503 is strictly better: the client already maps 503 to
 *     "the AI service isn't configured", and 500 invites a pointless retry.
 *
 * So the honest rule is not "503 everywhere". It is: never call the model with
 * a placeholder credential, and prefer the deterministic answer wherever one
 * exists. The astrology never needs a key and must always work.
 */
import type { Response } from "express";
import { isOpenAiConfigured } from "@workspace/integrations-openai-ai-server";

// NOT re-exported from here. Importing the flag and re-exporting it under the
// same name made esbuild emit a self-referential binding, and the bundle threw
// `ReferenceError: isOpenAiConfigured4 is not defined` at request time — with
// a clean build AND a clean typecheck. Routes import it from the package.

/** Says the AI is off without implying the rest of the app is. */
export const AI_UNCONFIGURED_MESSAGE =
  "The AI features are switched off on this server right now — everything computed from the sky still works.";

/**
 * For a route with NO deterministic fallback. Returns true when it has already
 * answered, so the caller just returns:
 *
 *   if (aiUnavailable(res)) return;
 */
export function aiUnavailable(res: Response): boolean {
  if (isOpenAiConfigured) return false;
  res.status(503).json({ error: AI_UNCONFIGURED_MESSAGE, code: "ai_unconfigured" });
  return true;
}
