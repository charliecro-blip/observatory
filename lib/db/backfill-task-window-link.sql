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
--   * only where exactly ONE window matches, so nothing ambiguous is guessed;
--   * matched within the same tester, never across accounts;
--   * idempotent — re-running changes nothing.
--
-- Measured before running (production, 2026-08-04): 16 tasks, 12 windows,
-- 9 title matches, 0 ambiguous.
UPDATE tasks t
SET planning_window_id = m.window_id
FROM (
  SELECT t2.id AS task_id, MIN(w.id) AS window_id
  FROM tasks t2
  JOIN planning_windows w
    ON w.tester_id = t2.tester_id
   AND lower(trim(w.title)) = lower(trim(t2.title))
  WHERE t2.planning_window_id IS NULL
  GROUP BY t2.id
  HAVING COUNT(DISTINCT w.id) = 1
) m
WHERE t.id = m.task_id;
