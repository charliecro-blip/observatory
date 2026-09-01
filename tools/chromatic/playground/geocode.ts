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
 * UTC offset, in hours, for a wall-clock birth moment in an IANA zone.
 * Fractional zones (India 5.5, Nepal 5.75) come out exact; DST resolves to
 * whatever rule the zone ran on that date.
 */
export function utcOffsetHours(timezone: string, dateStr: string, timeStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let instant = wall;
  for (let i = 0; i < 3; i++) instant = wall - zoneOffsetMs(timezone, instant);
  return zoneOffsetMs(timezone, instant) / 3_600_000;
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
        // the list re-fills everything.
        results.innerHTML = found.map((r, i) => `<option value="${i}">${r.label}</option>`).join("");
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
 * manual offset field. Writes the resolved value back for visibility.
 */
export function resolveOffset(prefix: string, dateStr: string, timeStr: string): number {
  const input = document.getElementById(`${prefix}-place`) as HTMLInputElement;
  const offsetEl = document.getElementById(`${prefix}-offset`) as HTMLInputElement;
  if (input?.dataset.tz) {
    const offset = utcOffsetHours(input.dataset.tz, dateStr, timeStr);
    offsetEl.value = String(offset);
    return offset;
  }
  return parseFloat(offsetEl.value);
}
