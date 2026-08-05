-- One-time backfill for tasks.planning_window_id.
--
-- The Planner created a task and a window in the same breath and forgot they
-- were the same thing, so the relation was inferred downstream by comparing
-- normalised titles. Title equality is not an identity relation — two tasks
-- called "Send invoice" collapsed into one — so a genuinely loose task could
-- vanish from the loose list.
--
-- This is the heuristic join run ONCE, as a migration, so the lookup can be
-- deleted from the render path. Deliberately conservative:
--
--   * only rows where the link is currently NULL;
--   * only where exactly ONE window matches the task…
--   * …AND exactly one task matches that window (see below);
--   * matched within the same tester, never across accounts;
--   * idempotent — re-running changes nothing.
--
-- THE GUARD WAS ONE-DIRECTIONAL, AND THAT WAS THE WHOLE BUG AGAIN.
-- ---------------------------------------------------------------------------
-- The first version required `COUNT(DISTINCT w.id) = 1` — that a task match
-- exactly one window. It did not require the converse. Dry-run against
-- production, 2026-08-05: of 9 candidate rows, 4 were two pairs of
-- same-titled tasks each claiming the SAME window (two "write the outline"
-- both taking window 11; two "survey 20 readers" both taking window 12).
--
-- Linking both would have told the app that two different tasks are each the
-- task for one window — and `your-day.ts` filters a task out of the loose list
-- whenever its window is in the timed set, so one genuinely loose task would
-- disappear. That is precisely the defect this migration exists to remove,
-- reproduced by the migration.
--
-- A title-based join can only be trusted where it is a BIJECTION. Where it is
-- not, the honest result is to leave the link NULL: we do not know which task
-- owns that window, and inventing an answer is worse than admitting it.
--
-- Measured on production, 2026-08-05: 17 tasks, 12 windows,
-- 9 one-directional matches, of which 5 are true 1:1 and 4 collide.
-- This links the 5. The 4 stay NULL.
WITH candidate AS (
  SELECT t2.id AS task_id, MIN(w.id) AS window_id
  FROM tasks t2
  JOIN planning_windows w
    ON w.tester_id = t2.tester_id
   AND lower(trim(w.title)) = lower(trim(t2.title))
  WHERE t2.planning_window_id IS NULL
  GROUP BY t2.id
  HAVING COUNT(DISTINCT w.id) = 1        -- one window per task…
),
bijective AS (
  SELECT task_id, window_id
  FROM candidate
  WHERE window_id IN (
    SELECT window_id FROM candidate GROUP BY window_id HAVING COUNT(*) = 1
  )                                       -- …and one task per window
)
UPDATE tasks t
SET planning_window_id = b.window_id
FROM bijective b
WHERE t.id = b.task_id;
