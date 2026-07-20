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

import { Router, type IRouter } from "express";
import path from "node:path";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildDayCardSvg, buildBestTimesCardSvg, buildActivityCardSvg, buildCycleWinsCardSvg, type CardTheme, type CardFormat } from "../lib/studioCard.js";
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
  return ACTIVITY_KEYS.has(activity)
    ? buildActivityCardSvg({ ...common, activity })
    : buildBestTimesCardSvg(common);
}

router.get("/studio/best.svg", (req, res) => {
  res.type("image/svg+xml").send(buildBest(req).svg);
});

router.get("/studio/best.png", async (req, res) => {
  try {
    const span = parseSpan(req);
    const { svg, width } = buildBest(req);
    const { Resvg } = await import("@resvg/resvg-js");
    const r = new Resvg(svg, {
      fitTo: { mode: "width", value: width },
      font: { fontBuffers: loadFonts(), loadSystemFonts: false, defaultFontFamily: "Spectral" },
    });
    const png = r.render().asPng();
    res.type("image/png").setHeader("Content-Disposition", `inline; filename="auspice-best-${span}.png"`).send(Buffer.from(png));
  } catch (e: any) {
    res.status(501).json({ error: "PNG rendering unavailable", detail: String(e?.message ?? e) });
  }
});

// Font buffers loaded once — everything in assets/fonts rides along.
let fontBuffers: Buffer[] | null = null;
function loadFonts(): Buffer[] {
  if (fontBuffers) return fontBuffers;
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets/fonts");
  fontBuffers = readdirSync(dir).filter(f => f.endsWith(".ttf")).map(f => readFileSync(path.join(dir, f)));
  return fontBuffers;
}

router.get("/studio/day.png", async (req, res) => {
  try {
    const { svg, width } = buildDayCardSvg(parseOpts(req));
    // Lazy import: the native module only loads when a PNG is actually asked
    // for, and a missing binary degrades to a clear 501 rather than a crash.
    const { Resvg } = await import("@resvg/resvg-js");
    const r = new Resvg(svg, {
      fitTo: { mode: "width", value: width },
      font: { fontBuffers: loadFonts(), loadSystemFonts: false, defaultFontFamily: "Spectral" },
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
      font: { fontBuffers: loadFonts(), loadSystemFonts: false, defaultFontFamily: "Spectral" },
    });
    res.type("image/png").setHeader("Content-Disposition", `inline; filename="auspice-cycle.png"`).send(Buffer.from(r.render().asPng()));
  } catch (e: any) {
    res.status(501).json({ error: "PNG rendering unavailable", detail: String(e?.message ?? e) });
  }
});

export default router;
