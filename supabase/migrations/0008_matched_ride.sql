-- Phase 6.5 — shared "matched ride" screen for both driver and passenger,
-- plus proper disband-with-seat-refund (closes the known gap where ending a
-- matched ride never gave the driver's seat back).

-- Everything the shared match/matched screen needs, in one round-trip.
-- security definer: a passenger has no RLS access to the driver's
-- ride_tokens/vehicles row (and vice versa isn't an issue since drivers can
-- already read matched ride_requests via request_targets), so this bypasses
-- RLS after confirming the caller is actually a participant.
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
  ride_request_id uuid, request_status text
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
    r.id, r.status
  from match_participants mp
  join profiles p on p.id = mp.profile_id
  left join ride_tokens t on t.id = v_match.ride_token_id
  left join vehicles veh on veh.id = t.vehicle_id
  left join ride_requests r on r.id = v_match.ride_request_id
  where mp.match_id = p_match_id
  order by (mp.profile_id <> v_me) desc
  limit 1;
end $$;

-- Either participant disbands THIS match only (not other passengers matched
-- to the same token). Gives the seat back and flips the token back to
-- 'live' if it had filled up -- only on the actual matched->cancelled
-- transition, so double-calling this can't double-refund a seat.
create or replace function cancel_match(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := current_profile_id();
  v_match matches%rowtype;
  v_cancelled_id uuid;
begin
  select * into v_match from matches where id = p_match_id;
  if v_match.id is null then
    raise exception 'match_not_found';
  end if;

  if not exists (
    select 1 from match_participants where match_id = p_match_id and profile_id = v_me
  ) then
    raise exception 'not_a_participant';
  end if;

  if v_match.ride_request_id is not null then
    update ride_requests set status = 'cancelled'
      where id = v_match.ride_request_id and status = 'matched'
      returning id into v_cancelled_id;

    if v_cancelled_id is not null and v_match.ride_token_id is not null then
      update ride_tokens
        set seats_left = least(seats_total, seats_left + 1),
            status = case when status = 'matched' and depart_at > now() then 'live' else status end
        where id = v_match.ride_token_id;
    end if;
  end if;
end $$;

-- Driver's currently-matched passengers for their active token (mirrors
-- driver_incoming's shape/style from 0005_realtime.sql). Plain invoker-rights
-- SQL: the driver already has RLS read access to matches (participant) and
-- to these specific ride_requests rows (via the accepted request_targets row).
create or replace function driver_matched_passengers(p_token_id uuid)
returns table (
  match_id uuid, request_id uuid,
  passenger_name text, passenger_photo text,
  pickup_label text, drop_label text, offered_price int, created_at timestamptz
) language sql stable as $$
  select m.id, r.id, p.full_name, p.photo_url, r.pickup_label, r.drop_label, r.offered_price, m.created_at
  from matches m
  join ride_requests r on r.id = m.ride_request_id
  join profiles p on p.id = r.passenger_id
  where m.ride_token_id = p_token_id and r.status = 'matched'
  order by m.created_at asc
$$;
