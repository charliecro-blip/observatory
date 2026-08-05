/**
 * Studio render endpoints — the automated arm of the in-app Studio.
 *
 *   GET /studio/day.svg?lat=&lon=&tz=&theme=&format=   → the day card as SVG
 *   GET /studio/day.png?lat=&lon=&tz=&theme=&format=   → rasterized 1080-px PNG
 *
 * The PNG is what the daily content pipeline consumes: hit it each morning
 * (cron, shortcut, or by hand) and post. Fonts (Spectral + both Noto symbol
 * faces) are vendored in assets/fonts and loaded into resvg, so the render
 * is byte-stable anywhere — no browser, no system fonts.
 */

import { ELECTION_CATEGORIES, scanElection } from "../lib/inceptionElection.js";
import { Router, type IRouter } from "express";
import path from "node:path";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildDayCardSvg, buildBestTimesCardSvg, buildActivityCardSvg, buildCycleWinsCardSvg, type CardTheme, type CardFormat, buildElectionCardSvg } from "../lib/studioCard.js";
import { computeMomentum } from "./momentum.js";

const router: IRouter = Router();

const THEMES = new Set(["tide", "almanac", "observatory", "minimal"]);
const FORMATS = new Set(["story", "post"]);

function parseOpts(req: any) {
  const lat = parseFloat(req.query.lat as string) || 40.7;
  const lon = parseFloat(req.query.lon as string) || -74.0;
  const tz = parseInt(req.query.tz as string, 10);
  const theme = THEMES.has(req.query.theme as string) ? (req.query.theme as CardTheme) : "tide";
  const format = FORMATS.has(req.query.format as string) ? (req.query.format as CardFormat) : "story";
  return { lat, lon, tzOffsetMin: Number.isFinite(tz) ? tz : 0, theme, format };
}

router.get("/studio/day.svg", (req, res) => {
  const { svg } = buildDayCardSvg(parseOpts(req));
  res.type("image/svg+xml").send(svg);
});

// Best-times cards — "when to do X" for the week (windows) / month (days).
// ?start=YYYY-MM-DD renders a future span (batch a month of weekly cards);
// ?tzLabel=ET stamps the card's clock timezone (times are universal instants).
function parseSpan(req: any): "week" | "month" {
  return req.query.span === "month" ? "month" : "week";
}
function parseStart(req: any, tzOffsetMin: number): Date | undefined {
  const s = req.query.start as string;
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  // Local noon of the requested date, expressed as a UTC instant.
  return new Date(Date.UTC(y, m - 1, d, 12) + tzOffsetMin * 60000);
}

// ?activity=effort|rest|connection|study renders a single-modality card.
const ACTIVITY_KEYS = new Set(["effort", "rest", "connection", "study"]);
function buildBest(req: any) {
  const base = parseOpts(req);
  const common = {
    ...base, span: parseSpan(req),
    startAt: parseStart(req, base.tzOffsetMin),
    tzLabel: (req.query.tzLabel as string) || undefined,
  };
  const activity = req.query.activity as string;
  // An unrecognised activity used to fall through to the general best-times
  // card, silently. You asked for a card about negotiating and got a card about
  // the week — same 200, same shape, no way to tell. The election categories
  // (business_launch, date, conversation…) are a DIFFERENT vocabulary from this
  // card's four buckets, so that fallback fired on every one of them.
  if (activity && !ACTIVITY_KEYS.has(activity)) {
    throw Object.assign(new Error(
      `Unknown activity "${activity}". This card takes one of: ${[...ACTIVITY_KEYS].join(", ")}. ` +
      `For a specific election use /studio/election.png?activity=<election category>.`,
    ), { status: 400 });
  }
  return activity
    ? buildActivityCardSvg({ ...common, activity })
    : buildBestTimesCardSvg(common);
}

router.get("/studio/best.svg", (req, res) => {
  try {
    res.type("image/svg+xml").send(buildBest(req).svg);
  } catch (e: any) {
    if (e?.status === 400) { res.status(400).json({ error: String(e.message) }); return; }
    throw e;
  }
});

router.get("/studio/best.png", async (req, res) => {
  try {
    const span = parseSpan(req);
    const { svg, width } = buildBest(req);
    const { Resvg } = await import("@resvg/resvg-js");
    const r = new Resvg(svg, {
      fitTo: { mode: "width", value: width },
      font: { fontFiles: loadFonts(), loadSystemFonts: false, defaultFontFamily: "Spectral" },
    });
    const png = r.render().asPng();
    res.type("image/png").setHeader("Content-Disposition", `inline; filename="auspice-best-${span}.png"`).send(Buffer.from(png));
  } catch (e: any) {
    // A bad parameter is a 400, not a 501 "rendering unavailable" — the latter
    // reads as our fault and sends someone looking in the wrong place.
    if (e?.status === 400) { res.status(400).json({ error: String(e.message) }); return; }
    res.status(501).json({ error: "PNG rendering unavailable", detail: String(e?.message ?? e) });
  }
});

// ── /studio/election.png — the keepable artifact ─────────────────────────────
// PAYING-PERSONAS §A3 ranked this the best build-to-value item on the list, and
// it is what the "$49 elect a date" SKU actually hands over.
//
// It renders THE ELECTION THE USER IS LOOKING AT — same scanElection() the
// Begin screen calls, same categories, same verdicts. There is a second
// election system in this codebase (electionEngine's ACTIVITIES: endurance,
// haircut, negotiate…) with its own vocabulary; building the card against that
// one produced a beautiful picture of a different question.
router.get("/studio/election.png", async (req, res) => {
  try {
    const category = String(req.query.category ?? req.query.activity ?? "");
    const cat = ELECTION_CATEGORIES.find((c) => c.key === category);
    if (!cat) {
      res.status(400).json({
        error: `Unknown category "${category}".`,
        categories: ELECTION_CATEGORIES.map((c) => c.key),
      });
      return;
    }
    const lat = parseFloat(String(req.query.lat ?? "30.27"));
    const lon = parseFloat(String(req.query.lon ?? "-97.74"));
    const tz = parseInt(String(req.query.tz ?? "0"), 10) || 0;
    const days = Math.min(30, Math.max(1, parseInt(String(req.query.days ?? "14"), 10)));

    const scan = scanElection(category, new Date(), days, lat, lon);
    const all = (scan?.windows ?? []) as any[];
    // Only what the app itself would call worth beginning in. If nothing
    // clears, the card SAYS SO — the refusal is the most distinctive thing this
    // engine does and it belongs on the artifact people keep and send.
    const good = all.filter((w) => w.verdict === "strong" || w.verdict === "workable");
    const clock = (iso: string) => {
      const d = new Date(Date.parse(iso) - tz * 60000);
      let h = d.getUTCHours(); const m = d.getUTCMinutes();
      const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
      return m === 0 ? `${h} ${ap}` : `${h}:${String(m).padStart(2, "0")} ${ap}`;
    };
    const dow = (iso: string) => new Date(Date.parse(iso) - tz * 60000)
      .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

    // Civil hours only. The engine ranks the sky and will happily hand back
    // 2:29 AM as the strongest window to launch a business — astrologically
    // defensible, useless as an artifact someone acts on. This is a CARD
    // concern, not an engine one, so it is filtered here rather than there.
    const localHour = (iso: string) => new Date(Date.parse(iso) - tz * 60000).getUTCHours();
    const civil = good.filter((w) => localHour(w.windowStart) >= 7 && localHour(w.windowStart) < 21);
    // One per day, chronological. Eight rows from two days, out of order, is a
    // worse offer than five rows across five days.
    const seenDay = new Set<string>();
    const picked = civil
      .sort((a, b) => Date.parse(a.windowStart) - Date.parse(b.windowStart))
      .filter((w) => {
        const k = new Date(Date.parse(w.windowStart) - tz * 60000).toISOString().slice(0, 10);
        if (seenDay.has(k)) return false;
        seenDay.add(k); return true;
      });

    // One per day across the range — the card has room for more than six and
    // a fuller list is a better artifact.
    const windows = picked.slice(0, 9).map((w) => ({
      date: w.date, dow: dow(w.windowStart), startClock: clock(w.windowStart), endClock: clock(w.windowEnd),
      tier: (w.verdict === "strong" ? "great" : "good") as "great" | "good",
      // The receipts — and specifically the SUPPORTS. A passed hard/soft rule
      // is a hazard AVOIDED, and its label is the hazard's name, so listing
      // those printed "Moon void of course · Via combusta" as the reasons to
      // launch a business. Only `severity: "support"` rules are reasons.
      // The GREAT row carries a badge and so has less width — give it ONE full
      // reason rather than two with an ellipsis through the second. An
      // ellipsis on the row the card is pointing at is the worst place for one.
      why: (() => {
        const sup = (w.rules ?? []).filter((r: any) => r.passed && r.severity === "support").map((r: any) => r.label);
        if (!sup.length) return "clears every hard rule";
        return (w.verdict === "strong" ? sup.slice(0, 1) : sup.slice(0, 2)).join(" · ");
      })(),
    }));

    // If civil hours emptied the list but the sky did offer windows, say that
    // rather than claiming the sky refused.
    const nightOnly = windows.length === 0 && good.length > 0;
    const cautions = nightOnly
      ? ["The only windows in range fall in the middle of the night."]
      : windows.length === 0
      ? [(all[0]?.rules ?? []).filter((r: any) => !r.passed).map((r: any) => r.detail)[0]
          ?? "Nothing in this range clears the hard rules for this matter."]
      : [...new Set(all.flatMap((w) => (w.rules ?? []).filter((r: any) => !r.passed && r.severity === "soft").map((r: any) => r.label)))].slice(0, 2) as string[];

    const { svg, width } = buildElectionCardSvg({
      activityLabel: cat.label,
      windows, cautions, personalized: false,
      spanLabel: `the next ${days} days`,
      theme: (req.query.theme as any) || undefined,
      format: (req.query.format as any) || undefined,
      tzLabel: (req.query.tzLabel as string) || undefined,
    });

    const { Resvg } = await import("@resvg/resvg-js");
    const r = new Resvg(svg, {
      fitTo: { mode: "width", value: width },
      font: { fontFiles: loadFonts(), loadSystemFonts: false, defaultFontFamily: "Spectral" },
    });
    res.type("image/png")
      .setHeader("Content-Disposition", `inline; filename="compass-${category}.png"`)
      .send(Buffer.from(r.render().asPng()));
  } catch (e: any) {
    res.status(501).json({ error: "PNG rendering unavailable", detail: String(e?.message ?? e) });
  }
});

// Font buffers loaded once — everything in assets/fonts rides along.
let fontFilePaths: string[] | null = null;
// resvg-js 2.6.2 takes `fontFiles` (paths) — there is no `fontBuffers` option
// in this version, so passing Buffers meant the option was ignored entirely.
// Combined with loadSystemFonts:false that left the renderer with NO fonts at
// all, which is why the typechecker was complaining. Return paths instead.
function loadFonts(): string[] {
  if (fontFilePaths) return fontFilePaths;
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets/fonts");
  fontFilePaths = readdirSync(dir).filter(f => f.endsWith(".ttf")).map(f => path.join(dir, f));
  return fontFilePaths;
}

router.get("/studio/day.png", async (req, res) => {
  try {
    const { svg, width } = buildDayCardSvg(parseOpts(req));
    // Lazy import: the native module only loads when a PNG is actually asked
    // for, and a missing binary degrades to a clear 501 rather than a crash.
    const { Resvg } = await import("@resvg/resvg-js");
    const r = new Resvg(svg, {
      fitTo: { mode: "width", value: width },
      font: { fontFiles: loadFonts(), loadSystemFonts: false, defaultFontFamily: "Spectral" },
    });
    const png = r.render().asPng();
    res.type("image/png").setHeader("Content-Disposition", `inline; filename="auspice-day.png"`).send(Buffer.from(png));
  } catch (e: any) {
    res.status(501).json({ error: "PNG rendering unavailable", detail: String(e?.message ?? e) });
  }
});

// The personal cycle-in-wins card. Private data → the tester id rides in the
// query (?tester=) so the link is openable/bookmarkable from the app; ids are
// the app's existing bearer credential (the recovery-key account model).
router.get("/studio/cycle.png", async (req, res) => {
  try {
    const tester = (req.query.tester as string) || "";
    if (!tester) { res.status(401).json({ error: "tester required" }); return; }
    const base = parseOpts(req);
    const m = await computeMomentum(tester, base.tzOffsetMin, base.lat, base.lon);
    const { svg, width } = buildCycleWinsCardSvg(m, { theme: base.theme, format: base.format });
    const { Resvg } = await import("@resvg/resvg-js");
    const r = new Resvg(svg, {
      fitTo: { mode: "width", value: width },
      font: { fontFiles: loadFonts(), loadSystemFonts: false, defaultFontFamily: "Spectral" },
    });
    res.type("image/png").setHeader("Content-Disposition", `inline; filename="auspice-cycle.png"`).send(Buffer.from(r.render().asPng()));
  } catch (e: any) {
    res.status(501).json({ error: "PNG rendering unavailable", detail: String(e?.message ?? e) });
  }
});

export default router;
