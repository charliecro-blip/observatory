// Escaping regressions (2026-09-01 audit). No DOM environment exists in this
// suite, so the mechanics are tested on the shared esc() and the usage sites
// are pinned by source text — the same guard style tests/regressions.test.ts
// uses elsewhere in this repo.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { esc } from "../playground/esc";

const src = (name: string) => readFileSync(join(__dirname, "..", "playground", name), "utf8");

describe("esc()", () => {
  it("neutralizes markup payloads", () => {
    const img = esc('<img src=x onerror=alert(1)>');
    expect(img).not.toContain("<img");
    expect(img).toContain("&lt;img");
    const script = esc("<script>alert(1)</script>");
    expect(script).not.toContain("<script");
    expect(script).toContain("&lt;script&gt;");
    expect(esc(`"quoted" & 'single'`)).toBe("&quot;quoted&quot; &amp; &#39;single&#39;");
  });
});

describe("usage pins", () => {
  it("synastry crossings escape the user-typed names before innerHTML", () => {
    const meet = src("meet.ts");
    expect(meet).toContain('const firstA = esc(nameA.split(" ")[0]);');
    expect(meet).toContain('const firstB = esc(nameB.split(" ")[0]);');
    // The old vulnerable interpolation must not come back.
    expect(meet).not.toMatch(/\$\{nameA\.split/);
    expect(meet).not.toMatch(/\$\{nameB\.split/);
  });

  it("geocoder result labels go in as text nodes, never as markup", () => {
    const geocode = src("geocode.ts");
    expect(geocode).toContain("option.textContent = r.label");
    expect(geocode).not.toMatch(/\$\{r\.label\}/);
  });

  it("every page uses the one shared esc", () => {
    for (const page of ["color.ts", "meet.ts", "admin.ts", "main.ts"]) {
      const s = src(page);
      expect(s, page).toContain('import { esc } from "./esc"');
      expect(s, page).not.toMatch(/\nfunction esc\(/);
    }
  });
});
