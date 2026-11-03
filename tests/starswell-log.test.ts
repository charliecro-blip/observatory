import { describe, it, expect } from "vitest";
import { cleanEntry, latestMarks, KEY_MAX } from "../artifacts/api-server/src/lib/starswellLog.js";

const KEY = "11/02/2026|1793660000000|connect";

describe("a Starswell log entry is only a mark on a card", () => {
  it("accepts the three marks and null", () => {
    for (const value of ["did", "noticed", "skip", null]) expect(cleanEntry({ key: KEY, value })).toEqual({ key: KEY, value });
  });

  it("refuses any other value", () => {
    for (const value of ["DID", "loved it", 1, true, undefined, {}]) expect(cleanEntry({ key: KEY, value })).toBeNull();
  });

  it("refuses keys that are not date|hour|card", () => {
    for (const key of ["", "hello", "2026-11-02|1793660000000|connect", "11/02/2026|now|connect", "11/02/2026|1793660000000|", "11/02/2026|1793660000000|<script>", KEY + "x".repeat(KEY_MAX)]) {
      expect(cleanEntry({ key, value: "did" })).toBeNull();
    }
  });

  it("accepts the card ids the page builds", () => {
    for (const card of ["guard-Saturn", "attend-Neptune", "state-void", "act-garden", "cluster-care", "soften"]) {
      expect(cleanEntry({ key: "11/02/2026|1793660000000|" + card, value: "noticed" })).not.toBeNull();
    }
  });

  it("drops extra fields rather than storing them", () => {
    expect(cleanEntry({ key: KEY, value: "did", journal: "a private note" })).toEqual({ key: KEY, value: "did" });
  });

  it("survives junk", () => {
    for (const junk of [null, undefined, "string", 42, []]) expect(cleanEntry(junk)).toBeNull();
  });
});

describe("the latest mark wins", () => {
  it("keeps the last write per key and lets null take a mark back", () => {
    const rows = [
      { props: { key: KEY, value: "did" } },
      { props: { key: "11/02/2026|1793663300000|guard-Pluto", value: "noticed" } },
      { props: { key: KEY, value: "skip" } },
      { props: { key: "11/02/2026|1793663300000|guard-Pluto", value: null } },
      { props: { key: "junk", value: "did" } },
      { props: null },
    ];
    expect(latestMarks(rows)).toEqual({ [KEY]: "skip" });
  });
});
