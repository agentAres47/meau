-- F8 — ride completion -> ratings -> history. Additive + reversible.
-- Scoped to work WITHOUT the (unbuilt) state machine / QR: a ride goes
-- matched -> completed directly when the driver taps "End ride". Feedback
-- follows PRODUCT_MEMORY: sentiment (smooth/mostly/not_smooth) first, then stars
-- for positive, written note for negative.

-- Completion marker on the match (no ride_requests enum change needed).
alter table matches add column if not exists completed_at timestamptz;

-- Denormalized rating summary for cheap display (a driver's ⭐ average).
alter table profiles add column if not exists rating_avg numeric(3,2);
alter table profiles add column if not exists rating_count int not null default 0;

-- matches already emits realtime (added by 0012_autopool_leave.sql) — that's
-- what subscribeMatch relies on to flip the counterparty's screen to "rate" live.

-- Ratings — one per rater per match. Locked down (RLS on, zero client policies):
-- only the security-definer RPCs below write it; clients read the denormalized
-- profiles.rating_avg instead. Same pattern as notifications_outbox / admins.
create table if not exists ratings (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid not null references matches(id) on delete cascade,
  rater_id uuid not null references profiles(id) on delete cascade,
  ratee_id uuid not null references profiles(id) on delete cascade,
  sentiment text not null check (sentiment in ('smooth','mostly','not_smooth')),
  stars int check (stars between 1 and 5),
  note text,
  created_at timestamptz default now(),
  unique (match_id, rater_id)
);
alter table ratings enable row level security;

-- End the ride: mark it completed (idempotent) + nudge the other party to rate.
create or replace function end_ride(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := current_profile_id();
begin
  if not exists (
    select 1 from match_participants where match_id = p_match_id and profile_id = v_me
  ) then
    raise exception 'not_a_participant';
  end if;

  update matches set completed_at = now() where id = p_match_id and completed_at is null;

  begin
    insert into notifications_outbox (profile_id, title, body, data)
      select mp.profile_id, 'Ride complete', 'How was your ride? Tap to rate.',
             jsonb_build_object('type', 'rate', 'matchId', p_match_id)
      from match_participants mp
      where mp.match_id = p_match_id and mp.profile_id <> v_me;
  exception when others then
    raise warning 'end_ride: notify enqueue failed: %', sqlerrm;
  end;
end $$;

-- Submit a rating for a completed match. sentiment required; stars optional
-- (positive path); note optional (negative path). One per rater per match.
create or replace function submit_rating(
  p_match_id uuid, p_sentiment text, p_stars int, p_note text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := current_profile_id();
  v_ratee uuid;
begin
  if not exists (select 1 from matches where id = p_match_id and completed_at is not null) then
    raise exception 'not_completed';
  end if;

  select mp.profile_id into v_ratee from match_participants mp
    where mp.match_id = p_match_id and mp.profile_id <> v_me limit 1;
  if v_ratee is null then
    return; -- solo/self-match: nothing to rate
  end if;

  insert into ratings (match_id, rater_id, ratee_id, sentiment, stars, note)
    values (p_match_id, v_me, v_ratee, p_sentiment, p_stars, nullif(trim(p_note), ''))
    on conflict (match_id, rater_id) do nothing;

  if p_stars is not null then
    update profiles p set
      rating_count = (select count(*) from ratings where ratee_id = v_ratee and stars is not null),
      rating_avg   = (select round(avg(stars), 2) from ratings where ratee_id = v_ratee and stars is not null)
    where p.id = v_ratee;
  end if;
end $$;

-- match_status (0008) redefined VERBATIM + one added output column
-- (completed_at), so the matched screen can show "End ride" and react to
-- completion. No other change to the function body/logic.
-- Adding an output column changes the return type, which CREATE OR REPLACE
-- can't do for a RETURNS TABLE function — must drop first. Safe: match_status
-- is a leaf RPC called only from the app, no DB objects depend on it.
drop function if exists match_status(uuid);
create or replace function match_status(p_match_id uuid)
returns table (
  kind text, my_role text,
  other_id uuid, other_name text, other_photo text, other_role text,
  vehicle_type text, vehicle_seats_total int,
  seats_occupied int, my_seat_index int,
  origin_label text, dest_label text, route_polyline text, depart_at timestamptz, price_per_seat int,
  pickup_label text, drop_label text,
  pickup_lng double precision, pickup_lat double precision,
  drop_lng double precision, drop_lat double precision,
  ride_request_id uuid, request_status text,
  completed_at timestamptz
) language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := current_profile_id();
  v_match matches%rowtype;
  v_my_role text;
begin
  select * into v_match from matches where id = p_match_id;
  if v_match.id is null then
    raise exception 'match_not_found';
  end if;

  select mp.role into v_my_role from match_participants mp
    where mp.match_id = p_match_id and mp.profile_id = v_me;
  if v_my_role is null then
    raise exception 'not_a_participant';
  end if;

  return query
  select
    v_match.kind, v_my_role,
    mp.profile_id, p.full_name, p.photo_url, mp.role,
    veh.type, t.seats_total,
    (select count(*)::int from matches m2
       join ride_requests rr2 on rr2.id = m2.ride_request_id
       where m2.ride_token_id = v_match.ride_token_id and rr2.status = 'matched'),
    (select count(*)::int from matches m2
       join ride_requests rr2 on rr2.id = m2.ride_request_id
       where m2.ride_token_id = v_match.ride_token_id and rr2.status = 'matched'
         and m2.created_at < v_match.created_at),
    t.origin_label, t.dest_label, t.route_polyline, t.depart_at, t.price_per_seat,
    r.pickup_label, r.drop_label,
    st_x(r.pickup::geometry), st_y(r.pickup::geometry),
    st_x(r.drop_point::geometry), st_y(r.drop_point::geometry),
    r.id, r.status,
    v_match.completed_at
  from match_participants mp
  join profiles p on p.id = mp.profile_id
  left join ride_tokens t on t.id = v_match.ride_token_id
  left join vehicles veh on veh.id = t.vehicle_id
  left join ride_requests r on r.id = v_match.ride_request_id
  where mp.match_id = p_match_id
  order by (mp.profile_id <> v_me) desc
  limit 1;
end $$;

-- Current user's ride history: completed rides + cancelled ones, both kinds.
-- Autopool has no ride_tokens/ride_requests row (route label + typical fare are
-- client-side constants in PRESET_ROUTES, same as getAutopoolChatMeta), so this
-- returns route_code + pool_size and the CLIENT resolves the label/split fare —
-- mirroring the existing pattern instead of duplicating PRESET_ROUTES in SQL.
-- Security definer so it can join the counterparty + token/request in one
-- round-trip.
create or replace function my_ride_history()
returns table (
  match_id uuid, kind text,
  other_name text, other_photo text,
  origin_label text, dest_label text, fare int,
  route_code text, pool_size int,
  when_at timestamptz, completed boolean, i_rated boolean
) language plpgsql security definer set search_path = public as $$
declare v_me uuid := current_profile_id();
begin
  return query
  select
    m.id, m.kind,
    (select p2.full_name from match_participants mp2 join profiles p2 on p2.id = mp2.profile_id
       where mp2.match_id = m.id and mp2.profile_id <> v_me limit 1),
    (select p2.photo_url from match_participants mp2 join profiles p2 on p2.id = mp2.profile_id
       where mp2.match_id = m.id and mp2.profile_id <> v_me limit 1),
    coalesce(t.origin_label, ''), coalesce(t.dest_label, ''),
    coalesce(t.price_per_seat, r.offered_price),
    aps.route_code,
    (select count(*)::int from match_participants where match_id = m.id),
    coalesce(m.completed_at, m.created_at),
    (m.completed_at is not null),
    exists (select 1 from ratings ra where ra.match_id = m.id and ra.rater_id = v_me)
  from matches m
  join match_participants me on me.match_id = m.id and me.profile_id = v_me
  left join ride_tokens t on t.id = m.ride_token_id
  left join ride_requests r on r.id = m.ride_request_id
  left join auto_pool_sessions aps on aps.pool_group_id = m.pool_group_id and aps.profile_id = v_me
  where m.completed_at is not null
     or (r.id is not null and r.status = 'cancelled')
  order by coalesce(m.completed_at, m.created_at) desc
  limit 50;
end $$;
