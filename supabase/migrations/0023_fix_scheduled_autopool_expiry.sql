-- #9 — scheduled Auto Pool sessions were silently dying. expire_stale_rows()
-- (0001_init.sql, unchanged since the very first migration) expired ANY
-- 'waiting' auto_pool_sessions row 5 minutes after CREATION, regardless of
-- mode. Correct for mode='now' (give up if nobody's found quickly), wrong for
-- mode='scheduled' — a session for a slot 2 hours out was being killed 5
-- minutes after you created it, long before its actual slot_time, so it never
-- had a real chance to match anyone.
--
-- Fix: split the rule by mode. 'now' keeps the 5-minute creation-based expiry
-- (unchanged behavior). 'scheduled' now expires once its own slot_time has
-- passed, not on a fixed clock from creation.
create or replace function expire_stale_rows() returns void language plpgsql as $$
begin
  update ride_tokens set status = 'expired' where status = 'live' and depart_at < now();
  update ride_requests set status = 'expired' where status = 'searching' and desired_time < now() - interval '30 minutes';
  update auto_pool_sessions set status = 'expired'
    where status = 'waiting' and mode = 'now' and created_at < now() - interval '5 minutes';
  update auto_pool_sessions set status = 'expired'
    where status = 'waiting' and mode = 'scheduled' and slot_time < now();
end;
$$;
