/**
 * Account deletion — the other half of a privacy policy.
 *
 * The policy promises we will delete an account and everything attached to it.
 * Until now that promise was kept by hand, over email, which meant it was only
 * as good as someone remembering every table. This makes it a single call.
 *
 * Two decisions worth keeping:
 *
 * 1. **The table list is DERIVED, never hand-written.** It is read off the
 *    drizzle schema at runtime: every exported table carrying a `tester_id`
 *    column is in scope, automatically. A hand-maintained list is a promise
 *    that decays — the next table someone adds would silently survive deletion
 *    and nobody would find out until it mattered. `tests/regressions.test.ts`
 *    additionally asserts the schema and this module agree.
 *
 * 2. **External grants are revoked BEFORE local rows are dropped.** Deleting a
 *    Google token row only makes *us* forget it; the grant stays live on
 *    Google's side until it is explicitly revoked, so a "deleted" account could
 *    still appear in the user's Google security settings as an app with
 *    calendar access. Revocation is best-effort — if Google is down we still
 *    delete, and say so, rather than trapping the user in an account they asked
 *    to destroy.
 */
import { is } from "drizzle-orm";
import { eq, inArray } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import * as dbModule from "@workspace/db";
import { db, conversations, messages, googleCalTokens } from "@workspace/db";
import { logger } from "./logger.js";

const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export interface DeletionReport {
  testerId: string;
  /** table name → rows removed */
  deleted: Record<string, number>;
  totalRows: number;
  /** null when there was no Google connection to revoke */
  googleRevoked: boolean | null;
}

/**
 * Every table in the schema scoped to a single account, discovered rather than
 * listed. Exported so the regression suite can assert coverage against the
 * schema itself.
 */
export function testerScopedTables(): { name: string; table: PgTable; column: any }[] {
  const out: { name: string; table: PgTable; column: any }[] = [];
  for (const value of Object.values(dbModule)) {
    if (!is(value, PgTable)) continue;
    const config = getTableConfig(value as PgTable);
    const column = config.columns.find((c) => c.name === "tester_id");
    if (column) out.push({ name: config.name, table: value as PgTable, column });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Ask Google to revoke the grant. Returns false on any failure — including a
 * network error — because the caller reports this to the user honestly rather
 * than claiming a revocation that may not have happened.
 */
async function revokeGoogleGrant(testerId: string): Promise<boolean | null> {
  const row = (await db.select().from(googleCalTokens)
    .where(eq(googleCalTokens.testerId, testerId)).limit(1))[0];
  if (!row) return null; // nothing connected — not a failure

  // The refresh token is the grant; revoking it invalidates every access token
  // issued under it. Fall back to the access token if we never got one.
  const token = row.refreshToken ?? row.accessToken;
  if (!token) return null;
  try {
    const r = await fetch(GOOGLE_REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
      signal: AbortSignal.timeout(8000),
    });
    // 200 = revoked. 400 with invalid_token = already dead, which is the state
    // we wanted anyway, so treat it as success rather than alarming the user.
    if (r.ok) return true;
    const body = await r.text().catch(() => "");
    if (r.status === 400 && body.includes("invalid_token")) return true;
    logger.warn({ status: r.status, body: body.slice(0, 200) }, "account deletion: Google revoke refused");
    return false;
  } catch (e) {
    logger.warn({ e }, "account deletion: Google revoke failed");
    return false;
  }
}

/**
 * Delete an account and everything keyed to it.
 *
 * The row deletions run in one transaction: a partial delete is the worst
 * outcome available here — the user is told they're gone while some of their
 * data isn't, and they have no way to retry because their client-side identity
 * is already cleared. All or nothing.
 */
export async function deleteAccount(testerId: string): Promise<DeletionReport> {
  const googleRevoked = await revokeGoogleGrant(testerId);

  const tables = testerScopedTables();
  const deleted: Record<string, number> = {};

  await db.transaction(async (tx) => {
    // Advisor conversation content hangs off conversations by id, not by
    // tester_id, so it is not discoverable by the rule above. The FK cascades,
    // but only if the constraint actually exists in the deployed database —
    // this schema is applied with `drizzle-kit push` — so delete it explicitly
    // rather than trusting a constraint we cannot see from here.
    const convoIds = (await tx.select({ id: conversations.id }).from(conversations)
      .where(eq(conversations.testerId, testerId))).map((c) => c.id);
    if (convoIds.length > 0) {
      const r = await tx.delete(messages).where(inArray(messages.conversationId, convoIds));
      deleted["messages"] = r.rowCount ?? 0;
    } else {
      deleted["messages"] = 0;
    }

    for (const { name, table, column } of tables) {
      const r = await tx.delete(table).where(eq(column, testerId));
      deleted[name] = r.rowCount ?? 0;
    }
  });

  const totalRows = Object.values(deleted).reduce((a, b) => a + b, 0);
  logger.info({ testerId, totalRows, googleRevoked }, "account deleted");
  return { testerId, deleted, totalRows, googleRevoked };
}
