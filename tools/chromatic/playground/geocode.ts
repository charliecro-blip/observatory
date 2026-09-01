// Birthplace → coordinates + timezone, so nobody has to type a latitude.
//
// Geocoding uses Open-Meteo's public geocoding API (no key, CORS-open; only
// the typed place name leaves the browser). The result carries an IANA
// timezone, and the UTC offset at the birth moment comes from Intl against
// that zone — historical DST rules included — so the offset field takes care
// of itself. Manual coordinates remain as the fallback for offline use or a
// birthplace the search can't find. When this grows a product surface inside
// Compass, swap the fetch for the api-server's /api/location-search.

export interface PlaceResult {
  label: string;    // "Mumbai, Maharashtra, India"
  lat: number;
  lon: number;
  timezone: string; // IANA, e.g. "Asia/Kolkata"
}

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?count=6&language=en&name=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`geocoding failed (${res.status})`);
  const data = (await res.json()) as {
    results?: Array<{ name: string; admin1?: string; country?: string; latitude: number; longitude: number; timezone: string }>;
  };
  return (data.results ?? []).map((r) => ({
    label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
    lat: r.latitude,
    lon: r.longitude,
    timezone: r.timezone,
  }));
}

function zoneOffsetMs(timezone: string, instantMs: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(instantMs)).map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    parts.hour === "24" ? 0 : Number(parts.hour), Number(parts.minute), Number(parts.second),
  );
  return asUtc - instantMs;
}

/**
 * What a wall-clock time actually was in a zone. Most times are exact; the
 * two DST edge cases are named instead of silently guessed (2026-09-01
 * audit), because a one-hour slip moves houses and angles:
 * - nonexistent: clocks jumped forward over this time (spring gap)
 * - ambiguous: clocks fell back and this time occurred twice
 */
export type WallTimeResolution =
  | { kind: "exact"; offsetHours: number }
  | { kind: "ambiguous"; candidates: [number, number] } // first occurrence first
  | { kind: "nonexistent"; beforeOffsetHours: number; afterOffsetHours: number };

export function resolveWallTime(timezone: string, dateStr: string, timeStr: string): WallTimeResolution {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  // Candidate offsets are sampled far enough on each side of the wall moment
  // (±26h clears the largest real offsets) to see both regimes of any nearby
  // transition; an offset is valid only if it round-trips the wall clock.
  const probes = new Set<number>();
  for (const dh of [-26, -2, 0, 2, 26]) probes.add(zoneOffsetMs(timezone, wall + dh * 3_600_000));
  const valid = [...probes]
    .filter((o) => zoneOffsetMs(timezone, wall - o) === o)
    .sort((a, b) => b - a); // larger offset = earlier instant, so first occurrence first
  if (valid.length === 1) {
    return { kind: "exact", offsetHours: valid[0] / 3_600_000 };
  }
  if (valid.length >= 2) {
    return { kind: "ambiguous", candidates: [valid[0] / 3_600_000, valid[1] / 3_600_000] };
  }
  return {
    kind: "nonexistent",
    beforeOffsetHours: zoneOffsetMs(timezone, wall - 26 * 3_600_000) / 3_600_000,
    afterOffsetHours: zoneOffsetMs(timezone, wall + 26 * 3_600_000) / 3_600_000,
  };
}

/**
 * UTC offset, in hours, for a wall-clock birth moment in an IANA zone.
 * Fractional zones (India 5.5, Nepal 5.75) come out exact; DST resolves to
 * whatever rule the zone ran on that date. On the two transition edge cases
 * this picks a documented side — first occurrence when ambiguous, the
 * post-change offset when nonexistent; use resolveWallTime (or dstNote) to
 * surface those to the user instead of trusting this blindly.
 */
export function utcOffsetHours(timezone: string, dateStr: string, timeStr: string): number {
  const resolved = resolveWallTime(timezone, dateStr, timeStr);
  switch (resolved.kind) {
    case "exact": return resolved.offsetHours;
    case "ambiguous": return resolved.candidates[0];
    case "nonexistent": return resolved.afterOffsetHours;
  }
}

const fmtOffset = (o: number) => `UTC${o >= 0 ? "+" : ""}${o}`;

/** A user-facing caution when the birth time sits on a DST transition, else null. */
export function dstNote(timezone: string, dateStr: string, timeStr: string): string | null {
  const resolved = resolveWallTime(timezone, dateStr, timeStr);
  if (resolved.kind === "nonexistent") {
    return `Clocks in ${timezone} jumped forward over this time on that date, so it never occurred on a clock. The chart uses the post-change offset (${fmtOffset(resolved.afterOffsetHours)}); worth checking the recorded time.`;
  }
  if (resolved.kind === "ambiguous") {
    return `Clocks in ${timezone} fell back that day, so this time occurred twice. The chart uses the first occurrence (${fmtOffset(resolved.candidates[0])}); the second was ${fmtOffset(resolved.candidates[1])}.`;
  }
  return null;
}

/**
 * Wire a place-search row: text input `#<p>-place`, find button `#<p>-find`,
 * results select `#<p>-place-results`, filling `#<p>-lat` / `#<p>-lon` and
 * remembering the zone on the place input's dataset for offset resolution.
 */
export function attachPlaceSearch(
  prefix: string,
  onError: (message: string) => void,
  onPick?: (r: PlaceResult) => void,
): void {
  const input = document.getElementById(`${prefix}-place`) as HTMLInputElement;
  const button = document.getElementById(`${prefix}-find`) as HTMLButtonElement;
  const results = document.getElementById(`${prefix}-place-results`) as HTMLSelectElement;
  let found: PlaceResult[] = [];

  const pick = (r: PlaceResult) => {
    input.value = r.label;
    input.dataset.tz = r.timezone;
    (document.getElementById(`${prefix}-lat`) as HTMLInputElement).value = String(r.lat);
    (document.getElementById(`${prefix}-lon`) as HTMLInputElement).value = String(r.lon);
    onPick?.(r);
  };

  const find = async () => {
    const q = input.value.trim();
    if (!q) return;
    button.disabled = true;
    try {
      found = await searchPlaces(q);
      if (found.length === 0) {
        onError(`No place found for "${q}". Try a larger nearby city, or open the manual coordinates below.`);
        results.hidden = true;
        return;
      }
      pick(found[0]);
      if (found.length > 1) {
        // Offer the alternatives after adopting the best match; picking from
        // the list re-fills everything. Labels come from an external API, so
        // they go in as text nodes, never as markup.
        results.replaceChildren(...found.map((r, i) => {
          const option = document.createElement("option");
          option.value = String(i);
          option.textContent = r.label;
          return option;
        }));
        results.selectedIndex = 0;
        results.hidden = false;
      }
    } catch {
      onError("Place lookup didn't answer. Check the connection, or open the manual coordinates below.");
    } finally {
      button.disabled = false;
    }
  };

  button.addEventListener("click", () => void find());
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void find();
    }
  });
  input.addEventListener("input", () => {
    // Typing again invalidates the picked place; manual coords take over.
    delete input.dataset.tz;
  });
  results.addEventListener("change", () => {
    const r = found[parseInt(results.value, 10)];
    if (r) pick(r);
  });
}

/**
 * Resolve the offset for a form: the picked place's zone wins; otherwise the
 * manual offset field. Writes the resolved value back for visibility, and
 * carries the DST caution when the birth time sits on a transition.
 */
export function resolveOffset(
  prefix: string, dateStr: string, timeStr: string,
): { offsetHours: number; dstNote: string | null } {
  const input = document.getElementById(`${prefix}-place`) as HTMLInputElement;
  const offsetEl = document.getElementById(`${prefix}-offset`) as HTMLInputElement;
  if (input?.dataset.tz) {
    const offset = utcOffsetHours(input.dataset.tz, dateStr, timeStr);
    offsetEl.value = String(offset);
    return { offsetHours: offset, dstNote: dstNote(input.dataset.tz, dateStr, timeStr) };
  }
  return { offsetHours: parseFloat(offsetEl.value), dstNote: null };
}
