-- Sprint 1 bug fixes (Priority 0). Additive only. See BUGFIX_PLAN.md.
--   BUG 1: incoming_request_detail — one request's detail for the targeted driver.
--   BUG 2: decline_target — decline reaches the passenger (realtime + push).
--   BUG 4: run_autopool_matching — enqueue a push when a pool forms (verbatim
--          0011 body + best-effort enqueue only; algorithm unchanged).

-- ============================================================================
-- BUG 1 — Ride Request decision screen data. Security definer: the screen shows
-- passenger + token route/coords the driver can't all read directly under RLS.
-- Guarded: only the targeted driver, only while the target is still pending.
-- lat = st_y, lng = st_x (matches match_status's convention).
-- ============================================================================
create or replace function incoming_request_detail(p_request_id uuid)
returns table (
  target_id uuid, token_id uuid, driver_id uuid,
  passenger_name text, passenger_photo text,
  pickup_label text, drop_label text,
  pickup_lat double precision, pickup_lng double precision,
  drop_lat double precision, drop_lng double precision,
  route_polyline text, depart_at timestamptz, offered_price int
) language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := current_profile_id();
begin
  return query
  select rt.id, rt.token_id, rt.driver_id,
    p.full_name, p.photo_url,
    r.pickup_label, r.drop_label,
    st_y(r.pickup::geometry), st_x(r.pickup::geometry),
    st_y(r.drop_point::geometry), st_x(r.drop_point::geometry),
    t.route_polyline, t.depart_at, r.offered_price
  from request_targets rt
  join ride_requests r on r.id = rt.request_id
  join profiles p on p.id = r.passenger_id
  join ride_tokens t on t.id = rt.token_id
  where rt.request_id = p_request_id
    and rt.driver_id = v_me
    and rt.state = 'pending'
  limit 1;
end $$;

-- ============================================================================
-- BUG 2 — Decline now propagates to the passenger. Previously the client wrote
-- request_targets.state directly, which the passenger's ride_requests
-- subscription never sees. This RPC declines the target, and ONLY when the
-- passenger has no other pending drivers left, cancels their request (so their
-- realtime subscription fires) and enqueues a best-effort push. Multi-target
-- searches are unaffected while any driver is still pending. Security definer:
-- passengers/ride_requests writes are cross-user.
-- ============================================================================
create or replace function decline_target(p_target_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := current_profile_id();
  v_request_id uuid;
  v_passenger_id uuid;
  v_remaining int;
begin
  update request_targets set state = 'declined'
    where id = p_target_id and driver_id = v_me and state = 'pending'
    returning request_id into v_request_id;
  if v_request_id is null then
    return; -- not this driver's target, or already resolved — no-op
  end if;

  select count(*) into v_remaining from request_targets
    where request_id = v_request_id and state = 'pending';

  if v_remaining = 0 then
    update ride_requests set status = 'cancelled'
      where id = v_request_id and status = 'searching'
      returning passenger_id into v_passenger_id;

    if v_passenger_id is not null then
      begin
        insert into notifications_outbox (profile_id, title, body, data)
        values (
          v_passenger_id,
          'No driver available',
          'No driver could take your ride right now. Please try again.',
          jsonb_build_object('type', 'request_declined', 'request_id', v_request_id)
        );
      exception when others then
        raise warning 'decline_target: notify enqueue failed: %', sqlerrm;
      end;
    end if;
  end if;
end $$;

-- ============================================================================
-- BUG 4 — Auto Pool push. This is migration 0011's run_autopool_matching body
-- reproduced VERBATIM, with the ONLY change being a best-effort notify enqueue
-- after each pool's match_participants insert. Matching logic is untouched.
-- ============================================================================
create or replace function run_autopool_matching() returns void language plpgsql as $$
declare
  v_group record;
  v_candidate_ids uuid[];
  v_ids uuid[];
  v_pool_id uuid;
  v_match_id uuid;
begin
  for v_group in
    select route_code
    from auto_pool_sessions
    where mode = 'now' and status = 'waiting' and created_at > now() - interval '5 minutes'
    group by route_code
    having count(distinct profile_id) >= 2
  loop
    loop
      select array_agg(id) into v_candidate_ids from (
        select id from (
          select distinct on (profile_id) id, created_at
          from auto_pool_sessions
          where route_code = v_group.route_code and mode = 'now' and status = 'waiting'
            and created_at > now() - interval '5 minutes'
          order by profile_id, created_at
        ) per_profile
        order by created_at
        limit 3
      ) top3;

      exit when v_candidate_ids is null or array_length(v_candidate_ids, 1) < 2;

      select array_agg(id order by created_at) into v_ids from (
        select id, created_at from auto_pool_sessions
        where id = any(v_candidate_ids) and status = 'waiting'
        order by created_at
        for update skip locked
      ) s;

      exit when v_ids is null or array_length(v_ids, 1) < 2;

      v_pool_id := uuid_generate_v4();
      update auto_pool_sessions set status = 'matched', pool_group_id = v_pool_id where id = any(v_ids);

      insert into matches (kind, pool_group_id) values ('autopool', v_pool_id) returning id into v_match_id;
      insert into match_participants (match_id, profile_id, role)
        select v_match_id, profile_id, 'pooler' from auto_pool_sessions where id = any(v_ids);

      begin
        insert into notifications_outbox (profile_id, title, body, data)
          select profile_id, 'Auto Pool matched',
                 'You''ve been pooled. Tap to open your ride.',
                 jsonb_build_object('type', 'autopool', 'matchId', v_match_id)
          from auto_pool_sessions where id = any(v_ids);
      exception when others then
        raise warning 'run_autopool_matching: notify enqueue failed: %', sqlerrm;
      end;
    end loop;
  end loop;

  for v_group in
    select route_code, slot_time
    from auto_pool_sessions
    where mode = 'scheduled' and status = 'waiting'
    group by route_code, slot_time
    having count(distinct profile_id) >= 2
  loop
    loop
      select array_agg(id) into v_candidate_ids from (
        select id from (
          select distinct on (profile_id) id, created_at
          from auto_pool_sessions
          where route_code = v_group.route_code and mode = 'scheduled'
            and slot_time = v_group.slot_time and status = 'waiting'
          order by profile_id, created_at
        ) per_profile
        order by created_at
        limit 3
      ) top3;

      exit when v_candidate_ids is null or array_length(v_candidate_ids, 1) < 2;

      select array_agg(id order by created_at) into v_ids from (
        select id, created_at from auto_pool_sessions
        where id = any(v_candidate_ids) and status = 'waiting'
        order by created_at
        for update skip locked
      ) s;

      exit when v_ids is null or array_length(v_ids, 1) < 2;

      v_pool_id := uuid_generate_v4();
      update auto_pool_sessions set status = 'matched', pool_group_id = v_pool_id where id = any(v_ids);

      insert into matches (kind, pool_group_id) values ('autopool', v_pool_id) returning id into v_match_id;
      insert into match_participants (match_id, profile_id, role)
        select v_match_id, profile_id, 'pooler' from auto_pool_sessions where id = any(v_ids);

      begin
        insert into notifications_outbox (profile_id, title, body, data)
          select profile_id, 'Auto Pool matched',
                 'You''ve been pooled. Tap to open your ride.',
                 jsonb_build_object('type', 'autopool', 'matchId', v_match_id)
          from auto_pool_sessions where id = any(v_ids);
      exception when others then
        raise warning 'run_autopool_matching: notify enqueue failed: %', sqlerrm;
      end;
    end loop;
  end loop;
end $$;
