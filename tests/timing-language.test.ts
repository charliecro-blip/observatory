import { describe, expect, it } from "vitest";
import { interpretTimingActivity } from "../artifacts/api-server/src/lib/timingInterpretation";

const examples: Array<[string, string]> = [
  ["fit in a hard workout", "train-hard"],
  ["go for a long run", "endurance"],
  ["do some gentle yoga", "gentle-movement"],
  ["take a restorative nap", "deep-rest"],
  ["get my hair cut", "haircut"],
  ["start a new diet", "start-regimen"],
  ["study for my exam", "deep-study"],
  ["write the first draft of my essay", "first-draft"],
  ["edit my manuscript", "edit-revise"],
  ["learn to play guitar", "learn-skill"],
  ["plan the next quarter", "strategize"],
  ["investigate a problem", "investigate"],
  ["give a presentation", "teach-present"],
  ["focus on coding", "deep-work"],
  ["spend the afternoon painting", "creative-practice"],
  ["finish the project", "finish-polish"],
  ["tidy my apartment", "organize"],
  ["fix the kitchen sink", "repair"],
  ["run my errands", "admin-errands"],
  ["ask for a raise", "negotiate"],
  ["have a difficult conversation", "hard-conversation"],
  ["submit my application", "apply-job"],
  ["host friends for dinner", "host"],
  ["meet some new people", "network"],
  ["call my mom", "call-family"],
  ["bake a loaf of bread", "cook"],
  ["decorate the living room", "beautify"],
  ["water the plants", "garden"],
  ["deep clean the garage", "deep-clean"],
  ["do my taxes", "budget"],
  ["buy a new laptop", "big-purchase"],
  ["pay off a debt", "settle-debts"],
  ["sit down to meditate", "meditate"],
  ["write in my journal", "journal"],
  ["do a tarot reading", "divination"],
  ["set intentions for the month", "set-intention"],
  ["take a solo retreat", "retreat"],
  ["publish my newsletter", "publish"],
  ["launch my new company", "launch-venture"],
  ["sign the contract", "sign-contract"],
  ["move into a new apartment", "move-home"],
  ["begin a business partnership", "begin-partnership"],
];

describe("timing language acceptance", () => {
  it.each(examples)("resolves %s", (text, key) => {
    const result = interpretTimingActivity(text);
    expect(result.state).toBe("resolved");
    expect(result.options[0]?.key).toBe(key);
  });
});
