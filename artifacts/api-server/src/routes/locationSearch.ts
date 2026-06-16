import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface GeoapifyFeature {
  properties: {
    formatted?: string;
    city?: string;
    state?: string;
    country?: string;
    country_code?: string;
    lat: number;
    lon: number;
    timezone?: {
      name: string;
      offset_STD: string;
      offset_STD_seconds: number;
      offset_DST: string;
      offset_DST_seconds: number;
      abbreviation_STD: string;
      abbreviation_DST: string;
    };
  };
}

export interface LocationResult {
  displayName: string;
  city: string | null;
  state: string | null;
  country: string | null;
  lat: number;
  lon: number;
  timezoneName: string | null;
  utcOffsetStandard: number | null;
  utcOffsetDST: number | null;
  abbreviationSTD: string | null;
  abbreviationDST: string | null;
}

// Simple in-memory LRU-style cache: key = query string, value = results + timestamp
const cache = new Map<string, { results: LocationResult[]; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX = 200;

function getCached(q: string): LocationResult[] | null {
  const entry = cache.get(q);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(q);
    return null;
  }
  return entry.results;
}

function setCache(q: string, results: LocationResult[]) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(q, { results, ts: Date.now() });
}

// GET /api/location-search?q=SEARCH_TEXT
router.get("/location-search", async (req, res) => {
  const apiKey = process.env["GEOAPIFY_API_KEY"];

  const q = typeof req.query["q"] === "string" ? req.query["q"].trim() : "";

  if (!apiKey) {
    res.status(503).json({
      error: "unavailable",
      message: "Birthplace lookup is unavailable. Enter latitude/longitude manually.",
    });
    return;
  }

  if (q.length < 3) {
    res.json([]);
    return;
  }

  const cached = getCached(q);
  if (cached) {
    res.json(cached);
    return;
  }

  try {
    const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
    url.searchParams.set("text", q);
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("limit", "5");
    url.searchParams.set("type", "city");
    url.searchParams.set("format", "geojson");

    const response = await fetch(url.toString());
    if (!response.ok) {
      req.log.error({ status: response.status }, "Geoapify request failed");
      res.status(502).json({ error: "upstream_error", message: "Location search failed." });
      return;
    }

    const data = (await response.json()) as { features?: GeoapifyFeature[] };
    const features = data.features ?? [];

    const results: LocationResult[] = features.map((f) => {
      const p = f.properties;
      const tz = p.timezone ?? null;
      return {
        displayName: p.formatted ?? "",
        city: p.city ?? null,
        state: p.state ?? null,
        country: p.country ?? null,
        lat: p.lat,
        lon: p.lon,
        timezoneName: tz?.name ?? null,
        utcOffsetStandard: tz ? tz.offset_STD_seconds / 3600 : null,
        utcOffsetDST: tz ? tz.offset_DST_seconds / 3600 : null,
        abbreviationSTD: tz?.abbreviation_STD ?? null,
        abbreviationDST: tz?.abbreviation_DST ?? null,
      };
    });

    setCache(q, results);
    res.json(results);
  } catch (err) {
    req.log.error({ err }, "Location search error");
    res.status(500).json({ error: "internal_error", message: "Location search failed." });
  }
});

export default router;
