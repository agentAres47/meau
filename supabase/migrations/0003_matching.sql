-- Matching helpers (specs/08-MATCHING-SERVER.md). The matching service (service
-- role) calls these. They exist to expose geography points as plain lng/lat so
-- turf can do the route math in Node (the route is stored as an encoded polyline,
-- not geometry, so PostGIS alone can't do the "on the way" check).

-- Passenger request as plain coords.
create or replace function request_geo(p_request_id uuid)
returns table (
  passenger_id uuid,
  pickup_lng double precision, pickup_lat double precision,
  drop_lng double precision, drop_lat double precision,
  desired_time timestamptz, offered_price int, status text
) language sql stable as $$
  select passenger_id,
    st_x(pickup::geometry), st_y(pickup::geometry),
    st_x(drop_point::geometry), st_y(drop_point::geometry),
    desired_time, offered_price, status
  from ride_requests where id = p_request_id
$$;

-- Live tokens departing within +/- p_window_min of the desired time, with driver
-- + vehicle info and origin/dest as plain coords.
create or replace function live_token_candidates(p_desired timestamptz, p_window_min int)
returns table (
  token_id uuid, driver_id uuid, vehicle_id uuid,
  origin_label text, dest_label text,
  origin_lng double precision, origin_lat double precision,
  dest_lng double precision, dest_lat double precision,
  route_polyline text, depart_at timestamptz,
  seats_total int, seats_left int, price_per_seat int,
  driver_name text, driver_photo text, driver_verified boolean,
  vehicle_make_model text, vehicle_color text, vehicle_type text
) language sql stable as $$
  select t.id, t.driver_id, t.vehicle_id, t.origin_label, t.dest_label,
    st_x(t.origin::geometry), st_y(t.origin::geometry),
    st_x(t.dest::geometry), st_y(t.dest::geometry),
    t.route_polyline, t.depart_at, t.seats_total, t.seats_left, t.price_per_seat,
    p.full_name, p.photo_url, p.is_driver_verified,
    v.make_model, v.color, v.type
  from ride_tokens t
  join profiles p on p.id = t.driver_id
  left join vehicles v on v.id = t.vehicle_id
  where t.status = 'live' and t.seats_left > 0
    and t.depart_at between p_desired - make_interval(mins => p_window_min)
                        and p_desired + make_interval(mins => p_window_min)
$$;
