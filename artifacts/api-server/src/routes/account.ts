/**
 * Account = tester-id recovery, right-sized for beta.
 *
 * The tester id (localStorage) is the identity every table keys on. These
 * routes give it a server-side profile row and a human-friendly recovery key,
 * so clearing the browser or switching devices no longer means losing
 * everything. No passwords, no email — the key is the secret.
 *
 * POST /api/account/sync     (x-tester-id) — upsert the profile, returns { recoveryCode }
 * POST /api/account/recover  { code }      — returns { testerId, profile } for a valid key
 */
import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { db, testerProfiles } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireTesterId } from "../middlewares/testerId.js";

const router: IRouter = Router();

// Unambiguous alphabet — no 0/O, 1/I/L — so the key survives handwriting.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function generateRecoveryCode(): string {
  const bytes = randomBytes(8);
  let raw = "";
  for (const b of bytes) raw += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `TIDE-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

function normalizeCode(input: string): string {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = cleaned.startsWith("TIDE") ? cleaned.slice(4) : cleaned;
  return `TIDE-${body.slice(0, 4)}-${body.slice(4, 8)}`;
}

router.post("/account/sync", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { displayName, chronotype, cautionPlanets, lat, lon, locationLabel } = req.body ?? {};

  const existing = (await db.select().from(testerProfiles)
    .where(eq(testerProfiles.testerId, testerId)).limit(1))[0] ?? null;

  const fields = {
    displayName: typeof displayName === "string" && displayName.trim() ? displayName.trim() : (existing?.displayName ?? "Observer"),
    chronotype: chronotype ?? existing?.chronotype ?? null,
    cautionPlanets: cautionPlanets ?? existing?.cautionPlanets ?? null,
    lat: lat != null ? String(lat) : (existing?.lat ?? null),
    lon: lon != null ? String(lon) : (existing?.lon ?? null),
    locationLabel: locationLabel ?? existing?.locationLabel ?? null,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(testerProfiles).set(fields).where(eq(testerProfiles.testerId, testerId));
    // Deliberately does NOT return the recovery code. The client is sent it
    // once, at creation, and keeps its own copy; re-issuing it on every sync
    // made the tester id equivalent to the key it is supposed to protect —
    // anyone holding an id could ask for the code and restore the account
    // anywhere. Someone who has lost their key can no longer mint a new one
    // from an id alone; they contact us.
    res.json({ ok: true });
    return;
  }

  // Collisions on an 8-char/31-alphabet code are vanishingly rare; retry a
  // couple of times anyway since the column is unique.
  for (let attempt = 0; attempt < 3; attempt++) {
    const recoveryCode = generateRecoveryCode();
    try {
      await db.insert(testerProfiles).values({ testerId, recoveryCode, ...fields });
      res.status(201).json({ recoveryCode });
      return;
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
});

router.post("/account/recover", async (req, res) => {
  const rawCode = (req.body?.code as string) ?? "";
  if (rawCode.replace(/[^A-Za-z0-9]/g, "").length < 8) {
    res.status(400).json({ error: "invalid_code", message: "That doesn't look like a full account key." });
    return;
  }
  const code = normalizeCode(rawCode);
  const row = (await db.select().from(testerProfiles)
    .where(eq(testerProfiles.recoveryCode, code)).limit(1))[0] ?? null;
  if (!row) {
    res.status(404).json({ error: "not_found", message: "No account matches that key — check it character by character." });
    return;
  }
  res.json({
    testerId: row.testerId,
    profile: {
      displayName: row.displayName,
      chronotype: row.chronotype,
      cautionPlanets: row.cautionPlanets,
      lat: row.lat != null ? parseFloat(row.lat) : undefined,
      lon: row.lon != null ? parseFloat(row.lon) : undefined,
      locationLabel: row.locationLabel ?? undefined,
      recoveryCode: row.recoveryCode,
    },
  });
});

export default router;
