-- 0027 — make account deletion actually work.
--
-- Five FKs in 0001_init.sql were created with no `on delete` action, so Postgres
-- defaulted them to NO ACTION. Deleting a user whose profile cascade touched any
-- of these rows threw a constraint violation. website/delete-account.html
-- publicly promises deletion (a Play Store requirement), so this must work.
--
-- Choice per FK:
--   set null  — denormalised pointers and optional links; the surviving row is
--               still meaningful without them.
--   cascade   — `matches` is the join row between two people. Once one side is
--               deleted the match, its participants and its chat are dead weight
--               (nameless counterpart, chat that can't continue), so it goes too.

alter table ride_tokens
  drop constraint ride_tokens_vehicle_id_fkey,
  add constraint ride_tokens_vehicle_id_fkey
    foreign key (vehicle_id) references vehicles(id) on delete set null;

alter table ride_requests
  drop constraint ride_requests_matched_token_id_fkey,
  add constraint ride_requests_matched_token_id_fkey
    foreign key (matched_token_id) references ride_tokens(id) on delete set null;

alter table ride_requests
  drop constraint ride_requests_matched_driver_id_fkey,
  add constraint ride_requests_matched_driver_id_fkey
    foreign key (matched_driver_id) references profiles(id) on delete set null;

alter table matches
  drop constraint matches_ride_token_id_fkey,
  add constraint matches_ride_token_id_fkey
    foreign key (ride_token_id) references ride_tokens(id) on delete cascade;

alter table matches
  drop constraint matches_ride_request_id_fkey,
  add constraint matches_ride_request_id_fkey
    foreign key (ride_request_id) references ride_requests(id) on delete cascade;

-- Check: every FK that can point at a user's data now has a delete action.
-- Expect zero rows. (confdeltype 'a' = NO ACTION)
do $$
declare v_bad text;
begin
  select string_agg(conrelid::regclass || '.' || conname, ', ')
    into v_bad
  from pg_constraint
  where contype = 'f'
    and confdeltype = 'a'
    and connamespace = 'public'::regnamespace;

  if v_bad is not null then
    raise exception 'FKs still block deletion: %', v_bad;
  end if;
end $$;
