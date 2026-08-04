-- F4 — Daily Commute routines (recurring driver availability).
--
-- A driver describes a trip they make regularly ("Mon–Fri, 09:00, Station →
-- Amity") once, and the system publishes a real ride_tokens row for it each
-- matching day, shortly before departure. Nothing about matching changes: an
-- auto-published token is an ordinary live token and flows through the existing
-- corridor matching untouched.
--
-- Design notes
-- * depart_time is a local wall-clock `time`, resolved against Asia/Kolkata.
--   India has no DST, so a fixed zone is correct here and avoids the whole
--   class of "the routine fired an hour early in March" bugs.
-- * Idempotency is a `last_published_on date` column, NOT a unique expression
--   index on ride_tokens. `timestamptz AT TIME ZONE text` is STABLE, not
--   IMMUTABLE, so it cannot legally appear in an index expression — a unique
--   index on "the local date of depart_at" would be rejected outright.
-- * Additive and reversible: nothing existing changes behaviour. ride_tokens
--   gains one nullable column.

create table if not exists commute_routines (
  id uuid primary key default uuid_generate_v4(),
  driver_id uuid not null references profiles(id) on delete cascade,
  -- A routine without a vehicle cannot produce a usable listing, so it dies
  -- with the vehicle rather than silently publishing vehicle-less rides.
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  origin_label text not null,
  origin geography(Point,4326) not null,
  dest_label text not null,
  dest geography(Point,4326) not null,
  route_polyline text not null,
  -- Postgres `dow`: 0 = Sunday … 6 = Saturday. Same convention as JS
  -- Date.getDay(), so the client can pass what it already has.
  days_of_week int[] not null check (
    array_length(days_of_week, 1) between 1 and 7
    and days_of_week <@ array[0,1,2,3,4,5,6]
  ),
  depart_time time not null,
  seats int not null check (seats between 1 and 6),
  price_per_seat int not null check (price_per_seat >= 0),
  status text not null default 'active' check (status in ('active','paused')),
  -- Set by publish_due_commutes() after a successful publish. This is the
  -- once-per-day guard.
  last_published_on date,
  created_at timestamptz default now()
);

alter table commute_routines enable row level security;

-- Same shape as ride_tokens_owner_crud: a driver sees and edits only their own.
drop policy if exists "commute_routines_owner_crud" on commute_routines;
create policy "commute_routines_owner_crud" on commute_routines for all
  using (driver_id = current_profile_id())
  with check (driver_id = current_profile_id());

-- Traceability: lets us tell an auto-published ride from a hand-posted one.
alter table ride_tokens add column if not exists commute_routine_id uuid
  references commute_routines(id) on delete set null;

create index if not exists commute_routines_active_idx
  on commute_routines (driver_id) where status = 'active';

-- Publishes every routine that is due. Runs on pg_cron every minute; safe to
-- run at any frequency because every skip condition below is idempotent.
create or replace function publish_due_commutes() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_now timestamptz := now();
  v_local timestamp := v_now at time zone 'Asia/Kolkata';
  v_today date := v_local::date;
  v_dow int := extract(dow from v_local)::int;
  v_depart timestamptz;
  t record;
begin
  for t in
    select * from commute_routines
    where status = 'active'
      and v_dow = any(days_of_week)
      and (last_published_on is null or last_published_on < v_today)
  loop
    -- Today's departure, interpreted as local wall-clock time.
    v_depart := (v_today + t.depart_time) at time zone 'Asia/Kolkata';

    -- Publish inside a window around departure only: up to 45 minutes early
    -- (so passengers can find it before it leaves) and up to 10 minutes late
    -- (a small catch-up if cron was down, still inside the 30-minute grace
    -- expire_stale_rows gives tokens). Outside that, leave it for tomorrow.
    if v_depart - v_now > interval '45 minutes' or v_depart < v_now - interval '10 minutes' then
      continue;
    end if;

    -- Never compete with a ride the driver posted by hand, and never stack two
    -- routines on the same driver.
    if exists (
      select 1 from ride_tokens where driver_id = t.driver_id and status = 'live'
    ) then
      continue;
    end if;

    insert into ride_tokens (
      driver_id, vehicle_id, origin_label, origin, dest_label, dest,
      route_polyline, depart_at, seats_total, seats_left, price_per_seat,
      status, commute_routine_id
    ) values (
      t.driver_id, t.vehicle_id, t.origin_label, t.origin, t.dest_label, t.dest,
      t.route_polyline, v_depart, t.seats, t.seats, t.price_per_seat,
      'live', t.id
    );

    update commute_routines set last_published_on = v_today where id = t.id;

    -- Best-effort, same pattern as every other enqueue here: a failed push must
    -- never roll back the publish.
    begin
      insert into notifications_outbox (profile_id, title, body, data)
      values (
        t.driver_id,
        'Your daily ride is live',
        t.origin_label || ' → ' || t.dest_label || ' is now visible to passengers.',
        jsonb_build_object('type', 'commute_live', 'routine_id', t.id)
      );
    exception when others then
      raise warning 'publish_due_commutes: notify enqueue failed: %', sqlerrm;
    end;
  end loop;
end $$;

-- Schedule it. Unschedule first so re-running this migration doesn't stack
-- duplicate jobs (cron.unschedule raises when absent — swallow that), matching
-- the pattern established in 0016.
do $$
begin
  perform cron.unschedule('meau_publish_due_commutes');
exception when others then null;
end $$;

select cron.schedule(
  'meau_publish_due_commutes',
  '* * * * *',
  $$ select public.publish_due_commutes(); $$
);
