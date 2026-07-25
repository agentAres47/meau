-- Root cause of the passenger<->matched infinite bounce loop, found live via
-- device debugging: end_ride() only ever set matches.completed_at. It never
-- touched ride_requests.status (stays 'matched' forever) or
-- auto_pool_sessions.status (same). getActiveRequest / getActivePoolSession
-- both filter on status in ('searching'|'waiting', 'matched') to find a
-- user's "current" ride -- so a ride that finished hours or days ago was
-- STILL being treated as an ongoing active match forever. The passenger tab
-- kept dismissTo-ing into the (correctly-completed) matched screen, which
-- kept dismissTo-ing back out once it saw completed_at set -- both sides were
-- individually correct, but the data never said the ride was over, so it
-- looped indefinitely.
--
-- Fix: add 'completed' as a valid terminal status to both tables (neither
-- client filter above includes it, so this alone makes both queries correctly
-- stop finding a completed ride -- no client changes needed), and have
-- end_ride() set it on whichever side applies (directed ride vs autopool).
alter table ride_requests drop constraint if exists ride_requests_status_check;
alter table ride_requests add constraint ride_requests_status_check
  check (status in ('searching','matched','cancelled','expired','completed'));

alter table auto_pool_sessions drop constraint if exists auto_pool_sessions_status_check;
alter table auto_pool_sessions add constraint auto_pool_sessions_status_check
  check (status in ('waiting','matched','cancelled','expired','completed'));

create or replace function end_ride(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := current_profile_id();
  v_match matches%rowtype;
begin
  if not exists (
    select 1 from match_participants where match_id = p_match_id and profile_id = v_me
  ) then
    raise exception 'not_a_participant';
  end if;

  update matches set completed_at = now() where id = p_match_id and completed_at is null
    returning * into v_match;

  -- Idempotent: if completed_at was already set (double-tap / realtime race),
  -- v_match is null here and there's nothing further to mark.
  if v_match.id is null then
    return;
  end if;

  if v_match.ride_request_id is not null then
    update ride_requests set status = 'completed'
      where id = v_match.ride_request_id and status = 'matched';
  end if;

  if v_match.pool_group_id is not null then
    update auto_pool_sessions set status = 'completed'
      where pool_group_id = v_match.pool_group_id and status = 'matched';
  end if;
end $$;
