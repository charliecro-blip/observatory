-- Additive Phase A migration. Apply to scratch/test databases first.
-- Production application is a separate release action.
ALTER TABLE planning_windows ADD COLUMN IF NOT EXISTS choice_key text;
ALTER TABLE planning_windows ADD COLUMN IF NOT EXISTS timing_provenance jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS planning_windows_choice_key_idx ON planning_windows (tester_id, choice_key);
