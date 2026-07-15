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
import { buildDayCardSvg, type CardTheme, type CardFormat } from "../lib/studioCard.js";

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

export default router;
