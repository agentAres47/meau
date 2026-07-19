-- Phase 0 — move time-based scheduling off the single Node process into
-- pg_cron, eliminating the single point of failure. See PHASE0_DESIGN.md.
--
-- Split (deliberately asymmetric — the two jobs have very different blast radii):
--   * expire_stale_rows()      -> pg_cron SOLE OWNER. It's correctness-critical
--     (stale 'live' tokens pollute matching) and non-latency-sensitive, so it
--     must not depend on the Node process. Removed from Node in this change.
--   * run_autopool_matching()  -> stays PRIMARY in Node at 5s (latency-critical
--     "match me now" flow). This migration adds a 60s pg_cron BACKSTOP so that
--     if Node is down, waiting poolers are still grouped within <=60s instead of
--     hanging until they expire. Double-execution (Node 5s + cron 60s) is safe:
--     run_autopool_matching uses FOR UPDATE SKIP LOCKED + per-profile dedup and
--     is idempotent by construction.
--
-- No function bodies change. No RLS/security-definer change. No client change.
-- Fully additive and reversible (see PHASE0_REPORT.md rollback plan).

-- pg_cron ships with Supabase; enabling is idempotent. If your project requires
-- enabling it from the dashboard first (Database > Extensions), do that, then
-- re-run this migration. Extension installs into the `cron` schema.
create extension if not exists pg_cron;

-- Re-running this migration must not stack duplicate jobs. Unschedule first if
-- present (cron.unschedule raises when the job is absent -> swallow that).
do $$
begin
  perform cron.unschedule('meau_expire_stale_rows');
exception when others then null;
end $$;

do $$
begin
  perform cron.unschedule('meau_autopool_safety_net');
exception when others then null;
end $$;

-- Expiry: sole owner. Every minute is well within the job's own tolerances
-- (which are 5-30 min), and matches the old 60s Node cadence closely enough
-- that no user-visible timing changes.
select cron.schedule(
  'meau_expire_stale_rows',
  '* * * * *',                 -- every minute (classic cron; no sub-minute dependency)
  $$ select public.expire_stale_rows(); $$
);

-- Auto-pool backstop: reliability net behind the Node 5s primary. Only does
-- real work when Node has missed a pairing (Node down, or a SKIP LOCKED
-- concurrent-join miss). Idempotent, so overlapping with the Node loop is safe.
select cron.schedule(
  'meau_autopool_safety_net',
  '* * * * *',                 -- every minute
  $$ select public.run_autopool_matching(); $$
);
