-- Phase 0 verification — run in the Supabase SQL editor AFTER applying
-- migration 0016. Safe to run against the live DB: it only reads cron metadata
-- and calls expire_stale_rows()/run_autopool_matching(), which are idempotent
-- and only ever touch genuinely-stale / genuinely-waiting rows (their normal
-- job). It creates no test data. Every check RAISEs on failure.

do $$
declare
  v_count int;
  v_ext   int;
begin
  -- 1. pg_cron extension is installed.
  select count(*) into v_ext from pg_extension where extname = 'pg_cron';
  if v_ext = 0 then
    raise exception 'FAIL: pg_cron extension not installed';
  end if;
  raise notice 'OK: pg_cron installed';

  -- 2. Both jobs are scheduled and active.
  select count(*) into v_count from cron.job
    where jobname = 'meau_expire_stale_rows' and active;
  if v_count <> 1 then
    raise exception 'FAIL: meau_expire_stale_rows not scheduled/active (found %)', v_count;
  end if;
  raise notice 'OK: meau_expire_stale_rows scheduled + active';

  select count(*) into v_count from cron.job
    where jobname = 'meau_autopool_safety_net' and active;
  if v_count <> 1 then
    raise exception 'FAIL: meau_autopool_safety_net not scheduled/active (found %)', v_count;
  end if;
  raise notice 'OK: meau_autopool_safety_net scheduled + active';

  -- 3. No DUPLICATE jobs (proves the migration is re-run-safe).
  select count(*) into v_count from cron.job
    where jobname in ('meau_expire_stale_rows', 'meau_autopool_safety_net');
  if v_count <> 2 then
    raise exception 'FAIL: expected exactly 2 Meau cron jobs, found % (duplicates?)', v_count;
  end if;
  raise notice 'OK: exactly 2 Meau cron jobs, no duplicates';

  -- 4. Both functions execute cleanly under this role (smoke test — idempotent).
  perform public.expire_stale_rows();
  raise notice 'OK: expire_stale_rows() callable';
  perform public.run_autopool_matching();
  raise notice 'OK: run_autopool_matching() callable';

  raise notice 'PHASE 0 VERIFICATION PASSED';
end $$;

-- Reference: inspect the schedule + recent run history yourself.
select jobid, jobname, schedule, active, command from cron.job
  where jobname like 'meau_%' order by jobname;

-- Recent executions (populates after the jobs have ticked at least once):
select j.jobname, r.status, r.start_time, r.end_time, r.return_message
  from cron.job_run_details r
  join cron.job j on j.jobid = r.jobid
  where j.jobname like 'meau_%'
  order by r.start_time desc
  limit 10;
