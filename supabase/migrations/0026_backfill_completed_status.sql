-- One-time backfill: 0025 fixed end_ride() going forward, but any match that
-- completed BEFORE that migration existed still has ride_requests.status /
-- auto_pool_sessions.status stuck on 'matched' forever (the exact live bug
-- being debugged). Apply the same terminal-status logic retroactively to
-- every already-completed match.
update ride_requests r set status = 'completed'
from matches m
where m.ride_request_id = r.id
  and m.completed_at is not null
  and r.status = 'matched';

update auto_pool_sessions a set status = 'completed'
from matches m
where m.pool_group_id = a.pool_group_id
  and m.completed_at is not null
  and a.status = 'matched';
