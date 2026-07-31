/**
 * POST /api/associate  { text, ai?: boolean }
 * Maps a phrase to a planetary/elemental/window signature (see lib/associate).
 * Deterministic by default; when ai:true and the model is reachable, it
 * enriches the reading — but always falls back to the keyword result so the
 * feature never depends on the AI being up.
 */
import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { associateDeterministic, PLANET_NAMES, WINDOW_TYPES, type Association } from "../lib/associate.js";
import { isOpenAiConfigured } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

router.post("/associate", async (req, res) => {
  const text = (req.body?.text as string)?.trim() ?? "";
  const useAi = req.body?.ai === true;
  if (!text) { res.status(400).json({ error: "text required" }); return; }

  const base = associateDeterministic(text);
  if (!useAi) { res.json(base); return; }
  // No key configured → the deterministic reading, which is what the catch
  // below would return anyway. Skipping the doomed round trip is the whole
  // point: a 503 here would replace a working answer with an error.
  if (!isOpenAiConfigured) { res.json(base); return; }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You map a short life-aim, task, or habit to an astrological timing signature. " +
            `Reply ONLY with JSON: {"element": one of fire|earth|air|water, "planets": array of 1-2 of ${PLANET_NAMES.join("|")}, "windowType": one of ${WINDOW_TYPES.join("|")}, "rationale": one plain sentence a non-astrologer understands, no jargon}. ` +
            "Choose the planet(s) whose classical significations best fit the words (e.g. structure/discipline/spine=Saturn, vitality/visibility=Sun, communication/learning=Mercury, relating/beauty/money=Venus, drive/exercise=Mars, growth/teaching=Jupiter, rest/care=Moon). " +
            "Element follows the lead planet. windowType is the kind of time-block it wants.",
        },
        { role: "user", content: text },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw);
    // Validate against our enums; fall back field-by-field to the deterministic base.
    const element = ["fire", "earth", "air", "water"].includes(parsed.element) ? parsed.element : base.element;
    const planets = Array.isArray(parsed.planets)
      ? parsed.planets.filter((p: string) => PLANET_NAMES.includes(p)).slice(0, 2)
      : base.planets;
    const windowType = WINDOW_TYPES.includes(parsed.windowType) ? parsed.windowType : base.windowType;
    const result: Association = {
      element, windowType,
      planets: planets.length ? planets : base.planets,
      rationale: typeof parsed.rationale === "string" && parsed.rationale.trim() ? parsed.rationale.trim() : base.rationale,
      source: "ai",
    };
    res.json(result);
  } catch {
    // AI unreachable or bad JSON — the deterministic reading is a fine answer.
    res.json(base);
  }
});

export default router;
