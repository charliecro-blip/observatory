/**
 * HELD-OUT REQUESTS FOR THE TIMING INTERPRETER (reset plan step 3, 2026-10-03).
 *
 * Ordinary requests, written the way the owner's own tasks and habits are
 * written, each with the answer a person would want. NOT part of the suite
 * and not a target to tune against: the development examples live in
 * tests/timing-*.test.ts. Keeping these apart is what lets the score below
 * mean something. Add cases; don't edit a case to match the parser.
 *
 * Run: pnpm run eval:timing  (prints a scorecard; never fails the build)
 *
 * Reference moment: Wednesday 2026-10-07, 9:00 AM, America/Chicago.
 */
import { interpretTimingRequest } from "../../artifacts/api-server/src/lib/timingRequest";

type When =
  | { day: number; part?: "morning" | "afternoon" | "evening" }   // days from today
  | { days: [number, number] }                                     // inclusive range of day offsets
  | "default"                                                      // the 7-day default is the right reading
  | "ask";                                                         // genuinely needs a question

interface Case { text: string; activity: string | string[] | "any"; when: When; minutes?: number }

const CASES: Case[] = [
  { text: "study for herbs tomorrow afternoon", activity: ["deep-study", "learn-skill"], when: { day: 1, part: "afternoon" } },
  { text: "2 hours of writing saturday morning", activity: ["first-draft", "deep-work"], when: { day: 3, part: "morning" }, minutes: 120 },
  { text: "when should I call mom this week", activity: "call-family", when: { days: [0, 4] } },
  { text: "make dr's appt", activity: "admin-errands", when: "default" },
  { text: "qigong tomorrow morning", activity: ["gentle-movement", "meditate"], when: { day: 1, part: "morning" } },
  { text: "first date friday night", activity: "first-date", when: { day: 2, part: "evening" } },
  { text: "launch my newsletter next week", activity: ["publish", "launch-venture", "launch"], when: { days: [5, 11] } },
  { text: "an hour to meditate tonight", activity: "meditate", when: { day: 0, part: "evening" }, minutes: 60 },
  { text: "deep work tomorrow 9am to noon", activity: "deep-work", when: { day: 1 }, minutes: 180 },
  { text: "go for a run after work", activity: ["train-hard", "endurance"], when: "ask" },
  { text: "hard conversation with my landlord", activity: "hard-conversation", when: "default" },
  { text: "sign the lease thursday", activity: "sign-contract", when: { day: 1 } },
  { text: "record a podcast episode monday afternoon", activity: ["teach-present", "creative-practice", "publish"], when: { day: 5, part: "afternoon" } },
  { text: "tarot study this evening", activity: ["divination", "deep-study"], when: { day: 0, part: "evening" } },
  { text: "film my animal series this weekend", activity: "creative-practice", when: { days: [3, 4] } },
  { text: "review my budget sunday", activity: "budget", when: { day: 4 } },
  { text: "rest", activity: "deep-rest", when: "default" },
  { text: "nap this afternoon", activity: "deep-rest", when: { day: 0, part: "afternoon" } },
  { text: "garden saturday", activity: "garden", when: { day: 3 } },
  { text: "ask for a raise next tuesday", activity: "negotiate", when: { day: 6 } },
  { text: "pitch investors in two weeks", activity: ["negotiate", "teach-present", "launch-venture"], when: "ask" },
  { text: "90 minutes of studying stats tomorrow", activity: "deep-study", when: { day: 1 }, minutes: 90 },
  { text: "write a first draft", activity: "first-draft", when: "default" },
  { text: "edit my essay this evening", activity: "edit-revise", when: { day: 0, part: "evening" } },
  { text: "apologize to my sister", activity: ["repair-bond", "hard-conversation"], when: "default" },
  { text: "meditate", activity: "meditate", when: "default" },
  { text: "yoga this weekend", activity: "gentle-movement", when: { days: [3, 4] } },
  { text: "clean the house saturday", activity: "deep-clean", when: { day: 3 } },
  { text: "cook for friends friday", activity: ["host", "cook"], when: { day: 2 } },
  { text: "job interview oct 14", activity: "apply-job", when: { day: 7 } },
  { text: "call the bank before 5", activity: "admin-errands", when: { day: 0 } },
  { text: "brainstorm names for the launch tomorrow", activity: ["strategize", "creative-practice", "first-draft"], when: { day: 1 } },
  { text: "a walk at lunch", activity: ["gentle-movement", "endurance"], when: { day: 0 } },
  { text: "read in the morning", activity: ["deep-study", "learn-skill"], when: { day: 1, part: "morning" } },
  { text: "practice guitar 30 min every day", activity: ["learn-skill", "creative-practice"], when: "ask", minutes: 30 },
  { text: "haircut friday", activity: "haircut", when: { day: 2 } },
  { text: "plan next month", activity: ["strategize", "organize"], when: "ask" },
  { text: "journal before bed", activity: "journal", when: { day: 0, part: "evening" } },
  { text: "start a new workout routine monday", activity: ["start-regimen", "train-hard"], when: { day: 5 } },
  // Corrected 2026-10-03, the one expectation changed after a run: apply-job is
  // labeled "Apply / submit" and lists "proposal" itself; the case was written
  // reading its key as job applications only.
  { text: "send the proposal tomorrow morning", activity: ["apply-job", "publish", "admin-errands", "negotiate"], when: { day: 1, part: "morning" } },
];

const TZ = "America/Chicago";
const NOW = new Date("2026-10-07T14:00:00Z");   // 9:00 AM CDT, a Wednesday
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
const offset = (n: number) => dayKey(new Date(+NOW + n * 86400000).toISOString());
// The horizon's end is exclusive: a whole Thursday ends at Friday 00:00.
const lastDay = (iso: string) => dayKey(new Date(Date.parse(iso) - 60000).toISOString());
const hourOf = (iso: string) => Number(new Date(iso).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", hour12: false }));

type Verdict = "right" | "asked" | "wrong";
const rows: { text: string; act: Verdict; when: Verdict; dur: Verdict | "-"; note: string }[] = [];

for (const c of CASES) {
  const r: any = interpretTimingRequest(c.text, TZ, NOW);
  const got = r.state === "resolved" ? r.options?.[0]?.key : null;
  const want = c.activity === "any" ? null : Array.isArray(c.activity) ? c.activity : [c.activity];
  const act: Verdict = r.state === "resolved"
    ? (!want || want.includes(got) ? "right" : "wrong")
    : "asked";

  const asked = r.unresolved.length > 0;
  let when: Verdict;
  let whenNote = "";
  if (c.when === "ask") when = asked ? "right" : "wrong";
  else if (asked) { when = "asked"; whenNote = r.unresolved[0]; }
  else if (c.when === "default") when = lastDay(r.horizon.end) >= offset(6) ? "right" : "wrong";
  else if ("days" in c.when) when = dayKey(r.horizon.start) === offset(Math.max(0, c.when.days[0])) && lastDay(r.horizon.end) === offset(c.when.days[1]) ? "right" : "wrong";
  else {
    const sameDay = dayKey(r.horizon.start) === offset(c.when.day) && lastDay(r.horizon.end) === offset(c.when.day);
    const part = c.when.part;
    const partOk = !part || (part === "morning" ? hourOf(r.horizon.start) < 12 && hourOf(r.horizon.end) <= 13
      : part === "afternoon" ? hourOf(r.horizon.start) >= 11 && hourOf(r.horizon.end) <= 19
      : hourOf(r.horizon.start) >= 16);
    when = sameDay && partOk ? "right" : "wrong";
    if (when === "wrong") whenNote = `searched ${dayKey(r.horizon.start)} ${hourOf(r.horizon.start)}h → ${lastDay(r.horizon.end)} ${hourOf(r.horizon.end)}h`;
  }
  const dur: Verdict | "-" = c.minutes == null ? "-" : r.durationMinutes === c.minutes ? "right" : "wrong";
  rows.push({ text: c.text, act, when, dur, note: [got && act === "wrong" ? `activity ${got}` : r.state !== "resolved" ? `activity ${r.state}` : "", whenNote, dur === "wrong" ? `duration ${r.durationMinutes ?? "none"}` : ""].filter(Boolean).join(" · ") });
}

const pct = (n: number) => `${Math.round((n / rows.length) * 100)}%`;
const count = (k: "act" | "when", v: Verdict) => rows.filter(r => r[k] === v).length;
const both = rows.filter(r => r.act === "right" && r.when === "right" && r.dur !== "wrong").length;
console.log(`\nTiming interpreter, held-out set (${rows.length} requests)\n`);
console.log(`Fully right, no question asked: ${both} (${pct(both)})`);
console.log(`Activity  right ${count("act", "right")} · asked ${count("act", "asked")} · WRONG ${count("act", "wrong")}`);
console.log(`When      right ${count("when", "right")} · asked ${count("when", "asked")} · WRONG ${count("when", "wrong")}\n`);
for (const r of rows) {
  const flag = r.act === "wrong" || r.when === "wrong" || r.dur === "wrong" ? "✗" : r.act === "asked" || r.when === "asked" ? "?" : "✓";
  console.log(`${flag} ${r.text.padEnd(44)} ${r.note}`);
}
