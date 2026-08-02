-- A "Now" ride died within 60 seconds of being posted.
--
-- The driver form sets depart_at = new Date() for a "now" ride (correct: it IS
-- departing now). expire_stale_rows() then killed any live token whose
-- depart_at had passed, and pg_cron runs it every minute (0016) — so the token
-- flipped to 'expired' on the very next tick, before any passenger could
-- realistically find it. Rides only matched when someone happened to search
-- inside that first minute.
--
-- The line directly below it in the same function already got this right:
-- ride_requests keep searching until 30 minutes PAST desired_time. Tokens were
-- given no grace at all, which reads as an oversight rather than a decision —
-- a ride leaving "now" is still a valid thing to join a couple of minutes
-- later, exactly like a request is.
--
-- Fix: give tokens the same 30-minute grace. Scheduled rides are unaffected in
-- spirit (they simply expire 30 min after their own departure instead of on
-- the dot), and the autopool rules from 0023 are carried over verbatim.
create or replace function expire_stale_rows() returns void language plpgsql as $$
begin
  update ride_tokens set status = 'expired'
    where status = 'live' and depart_at < now() - interval '30 minutes';
  update ride_requests set status = 'expired'
    where status = 'searching' and desired_time < now() - interval '30 minutes';
  update auto_pool_sessions set status = 'expired'
    where status = 'waiting' and mode = 'now' and created_at < now() - interval '5 minutes';
  update auto_pool_sessions set status = 'expired'
    where status = 'waiting' and mode = 'scheduled' and slot_time < now();
end;
$$;

-- Revive anything killed purely by the old rule: still live-worthy (departed
-- within the last 30 min), never matched, never cancelled by its driver.
update ride_tokens set status = 'live'
where status = 'expired'
  and depart_at > now() - interval '30 minutes'
  and seats_left > 0
  and id not in (select ride_token_id from matches where ride_token_id is not null);
