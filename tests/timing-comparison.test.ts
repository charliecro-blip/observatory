import { describe, it, expect } from "vitest";
import { searchTiming, type TimingSearchRequest } from "../artifacts/api-server/src/lib/timingSearch";
import { presentTiming } from "../artifacts/api-server/src/lib/timingPresentation";
import { computeElections, evaluateActivityInterval } from "../artifacts/api-server/src/lib/electionEngine";
import { findLongSessions } from "../artifacts/api-server/src/lib/longSession";
const q: TimingSearchRequest = {
  activity: "deep-work", start: "2026-09-05T05:00:00Z", end: "2026-09-07T05:00:00Z", timeZone: "America/Chicago", durationMinutes: 180,
  candidateIntervals: [{start:"2026-09-06T15:00:00Z",end:"2026-09-06T18:00:00Z"},{start:"2026-09-05T15:00:00Z",end:"2026-09-05T18:00:00Z"}],
};
const run = (request = q, comparison = evaluateActivityInterval) => {
 const result = searchTiming(request, {ordinary:computeElections,session:findLongSessions,comparison});
 if (!("days" in result)) throw Error(JSON.stringify(result));
 return result;
};
describe("supplied intervals through canonical timing search", () => {
 it("preserves chartless interval parity and supplied order without selecting a winner", () => {
  const r=run(); expect(r.status).toBe("complete"); expect(r.interpretation.mode).toBe("comparison");
  expect(r.context.location).toBe("unknown"); expect(r.coverage.boundaryPolicy).toBe("supplied_intervals");
  const p=presentTiming(r); expect(p.candidates).toHaveLength(2);
  for (const [i,c] of p.candidates.entries()) {
   const input=q.candidateIntervals![i];
   expect(c.start).toBe(new Date(input.start).toISOString());
   expect(c.evidence).toEqual(evaluateActivityInterval({activityKey:q.activity,startAt:new Date(input.start),endAt:new Date(input.end)}));
   expect(c).not.toHaveProperty("score"); expect(c).not.toHaveProperty("winner");
  }
 });
 it("marks calendar conflicts without changing evidence, identity or ordering", () => {
  const initial=presentTiming(run());
  const checked=presentTiming(run({...q,calendar:{source:"fixture",fetchedAt:"2026-09-04T12:00:00Z",result:{ok:true,connected:true,busy:[{startMs:Date.parse(q.candidateIntervals![0].start),endMs:Date.parse(q.candidateIntervals![0].end)}]}}}));
  expect(checked.candidates.map(c=>c.id)).toEqual(initial.candidates.map(c=>c.id));
  expect(checked.candidates.map(c=>c.evidence)).toEqual(initial.candidates.map(c=>c.evidence));
  expect(checked.candidates.map(c=>c.availability.status)).toEqual(["conflict","clear"]);
 });
 it("reports partial/error coverage for supplied intervals only", () => {
  let n=0; const r=run(q,opts=>n++===0?null:evaluateActivityInterval(opts));
  expect(r.status).toBe("partial"); expect(r.coverage.failed).toHaveLength(1);expect(r.coverage.scanned).toHaveLength(1);
  expect(presentTiming(r).candidates).toHaveLength(1);
  const failed=run(q,()=>null); expect(failed.status).toBe("error"); expect(failed.outcome).toBe("indeterminate");
 });
 it("keeps absolute instants and elapsed duration across a DST fold", () => {
  const candidates=[{start:"2026-11-01T01:30:00-05:00",end:"2026-11-01T01:30:00-06:00"},{start:"2026-11-01T01:30:00-06:00",end:"2026-11-01T02:30:00-06:00"}];
  const r=run({...q,start:"2026-11-01T00:00:00-05:00",end:"2026-11-02T00:00:00-06:00",durationMinutes:60,candidateIntervals:candidates});
  expect(r.coverage.scanned.map(c=>Date.parse(c.end)-Date.parse(c.start))).toEqual([3600000,3600000]);
  expect(r.coverage.scanned[0].end).toBe(r.coverage.scanned[1].start);
 });
 it("retains qualifications exactly from the evaluator", () => {
  const request={...q,activity:"sign-contract",start:"2026-10-25T00:00:00Z",end:"2026-10-27T00:00:00Z",candidateIntervals:[{start:"2026-10-25T12:00:00Z",end:"2026-10-25T15:00:00Z"},{start:"2026-10-26T12:00:00Z",end:"2026-10-26T15:00:00Z"}]};
  const cs=presentTiming(run(request)).candidates;
  expect(cs.some(c=>c.suitability!=="clear")).toBe(true);
  for(const c of cs) expect(c.reasons).toEqual(evaluateActivityInterval({activityKey:request.activity,startAt:new Date(c.start),endAt:new Date(c.end)})!.suitabilityReasons);
 });
 it("labels whole civil days broad rather than as selected sessions",()=>{
  const r=run({...q,durationMinutes:1440,candidateIntervals:[{start:q.start,end:"2026-09-06T05:00:00Z"},{start:"2026-09-06T05:00:00Z",end:q.end}]});
  expect(presentTiming(r).candidates.every(c=>c.broad)).toBe(true);
 });
 it.each([
  {candidateIntervals:[]}, {candidateIntervals:q.candidateIntervals!.slice(0,1)},
  {candidateIntervals:[...q.candidateIntervals!,...q.candidateIntervals!,...q.candidateIntervals!,...q.candidateIntervals!]},
  {durationMinutes:undefined}, {durationMinutes:120},
  {candidateIntervals:[q.candidateIntervals![0],{...q.candidateIntervals![1],start:"2026-09-04T15:00:00Z",end:"2026-09-04T18:00:00Z"}]},
  {candidateIntervals:[q.candidateIntervals![0],{...q.candidateIntervals![1],activity:"first-date"}]},
  {candidateIntervals:[q.candidateIntervals![0],q.candidateIntervals![0]]},
 ])("rejects invalid/mixed/duplicate requests before evaluation: %j", patch=>{
  let calls=0;const r=searchTiming({...q,...patch},{ordinary:computeElections,session:findLongSessions,comparison:()=>{calls++;return null;}});
  expect(r.status).toBe("invalid");expect(calls).toBe(0);
 });
});
