-- Production security boundaries.
-- The mobile client is untrusted: approval, ownership, and match transitions
-- must remain true even when PostgREST/RPCs are called outside the official UI.

-- ---------------------------------------------------------------------------
-- Profiles: owners may edit profile copy, never identity or verification flags.
-- Column grants complement the owner-only profiles_update_own RLS policy.
-- ---------------------------------------------------------------------------
revoke update on table public.profiles from public, anon, authenticated;
grant update (full_name, role, batch, department, phone, photo_url, gender)
  on table public.profiles to authenticated;

-- Licence applications always enter pending. Only the guarded admin RPC may
-- add review state and set profiles.is_driver_verified.
drop policy if exists "driver_verifications_owner_insert" on public.driver_verifications;
create policy "driver_verifications_owner_insert" on public.driver_verifications for insert
  with check (
    profile_id = current_profile_id()
    and status = 'pending'
    and reviewed_by is null
    and reject_reason is null
    and reviewed_at is null
  );
revoke update, delete on table public.driver_verifications from public, anon, authenticated;

-- A passenger may create/read their request. Matching and cancellation are
-- state transitions owned by service-role/RPC code, not direct table updates.
drop policy if exists "ride_requests_owner_crud" on public.ride_requests;
drop policy if exists "ride_requests_owner_select" on public.ride_requests;
drop policy if exists "ride_requests_owner_insert" on public.ride_requests;

create policy "ride_requests_owner_select" on public.ride_requests for select
  using (passenger_id = current_profile_id());

create policy "ride_requests_owner_insert" on public.ride_requests for insert
  with check (
    passenger_id = current_profile_id()
    and status = 'searching'
    and matched_token_id is null
    and matched_driver_id is null
  );
revoke update, delete on table public.ride_requests from public, anon, authenticated;

-- Pool grouping is likewise server-owned. Clients may create/read waiting rows;
-- cancellation goes through cancel_pool_session below.
drop policy if exists "auto_pool_sessions_owner_crud" on public.auto_pool_sessions;
drop policy if exists "auto_pool_sessions_owner_select" on public.auto_pool_sessions;
drop policy if exists "auto_pool_sessions_owner_insert" on public.auto_pool_sessions;

create policy "auto_pool_sessions_owner_select" on public.auto_pool_sessions for select
  using (profile_id = current_profile_id());

create policy "auto_pool_sessions_owner_insert" on public.auto_pool_sessions for insert
  with check (
    profile_id = current_profile_id()
    and status = 'waiting'
    and pool_group_id is null
    and (
      (mode = 'now' and slot_time is null)
      or (mode = 'scheduled' and slot_time is not null)
    )
  );
revoke update, delete on table public.auto_pool_sessions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ride publishing: only an approved driver using their own vehicle may create
-- a live token. Existing owner read/update/delete behaviour remains unchanged.
-- ---------------------------------------------------------------------------
drop policy if exists "ride_tokens_owner_crud" on public.ride_tokens;
drop policy if exists "ride_tokens_owner_select" on public.ride_tokens;
drop policy if exists "ride_tokens_verified_insert" on public.ride_tokens;
drop policy if exists "ride_tokens_owner_update" on public.ride_tokens;
drop policy if exists "ride_tokens_owner_delete" on public.ride_tokens;

create policy "ride_tokens_owner_select" on public.ride_tokens for select
  using (driver_id = current_profile_id());

create policy "ride_tokens_verified_insert" on public.ride_tokens for insert
  with check (
    driver_id = current_profile_id()
    and exists (
      select 1 from public.profiles p
      where p.id = driver_id and p.is_driver_verified
    )
    and exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.owner_id = driver_id
    )
  );

create policy "ride_tokens_owner_update" on public.ride_tokens for update
  using (driver_id = current_profile_id())
  with check (driver_id = current_profile_id());

create policy "ride_tokens_owner_delete" on public.ride_tokens for delete
  using (driver_id = current_profile_id());

-- Daily routines publish ride tokens later under a SECURITY DEFINER cron job,
-- so the routine itself must be verified when it enters the system.
drop policy if exists "commute_routines_owner_crud" on public.commute_routines;
drop policy if exists "commute_routines_owner_select" on public.commute_routines;
drop policy if exists "commute_routines_verified_insert" on public.commute_routines;
drop policy if exists "commute_routines_owner_update" on public.commute_routines;
drop policy if exists "commute_routines_owner_delete" on public.commute_routines;

create policy "commute_routines_owner_select" on public.commute_routines for select
  using (driver_id = current_profile_id());

create policy "commute_routines_verified_insert" on public.commute_routines for insert
  with check (
    driver_id = current_profile_id()
    and exists (
      select 1 from public.profiles p
      where p.id = driver_id and p.is_driver_verified
    )
    and exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.owner_id = driver_id
    )
  );

create policy "commute_routines_owner_update" on public.commute_routines for update
  using (driver_id = current_profile_id())
  with check (driver_id = current_profile_id());

create policy "commute_routines_owner_delete" on public.commute_routines for delete
  using (driver_id = current_profile_id());

-- Never return legacy/stale tokens whose driver is not currently approved.
create or replace function public.live_token_candidates(
  p_desired timestamptz,
  p_window_min int
) returns table (
  token_id uuid, driver_id uuid, vehicle_id uuid,
  origin_label text, dest_label text,
  origin_lng double precision, origin_lat double precision,
  dest_lng double precision, dest_lat double precision,
  route_polyline text, depart_at timestamptz,
  seats_total int, seats_left int, price_per_seat int,
  driver_name text, driver_photo text, driver_verified boolean,
  vehicle_make_model text, vehicle_color text, vehicle_type text
) language sql stable set search_path = public as $$
  select t.id, t.driver_id, t.vehicle_id, t.origin_label, t.dest_label,
    st_x(t.origin::geometry), st_y(t.origin::geometry),
    st_x(t.dest::geometry), st_y(t.dest::geometry),
    t.route_polyline, t.depart_at, t.seats_total, t.seats_left, t.price_per_seat,
    p.full_name, p.photo_url, p.is_driver_verified,
    v.make_model, v.color, v.type
  from public.ride_tokens t
  join public.profiles p on p.id = t.driver_id
  left join public.vehicles v on v.id = t.vehicle_id
  where t.status = 'live'
    and t.seats_left > 0
    and p.is_driver_verified
    and t.depart_at between p_desired - make_interval(mins => p_window_min)
                        and p_desired + make_interval(mins => p_window_min)
$$;

-- ---------------------------------------------------------------------------
-- Cancellation: only the passenger who owns a still-searching request may
-- dismiss its targets. The old second UPDATE was missing this ownership guard.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := current_profile_id();
  v_cancelled uuid;
begin
  update public.ride_requests
    set status = 'cancelled'
    where id = p_request_id
      and passenger_id = v_me
      and status = 'searching'
    returning id into v_cancelled;

  if v_cancelled is not null then
    update public.request_targets
      set state = 'dismissed'
      where request_id = v_cancelled and state = 'pending';
  end if;
end $$;

revoke execute on function public.cancel_request(uuid) from public, anon;
grant execute on function public.cancel_request(uuid) to authenticated;

create or replace function public.cancel_pool_session(p_session_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.auto_pool_sessions
    set status = 'cancelled'
    where id = p_session_id
      and profile_id = current_profile_id()
      and status = 'waiting';
end $$;

revoke execute on function public.cancel_pool_session(uuid) from public, anon;
grant execute on function public.cancel_pool_session(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Acceptance: the supplied driver must own the live token, be approved, and
-- have the exact pending target. Only the matching service may call this RPC.
-- ---------------------------------------------------------------------------
create or replace function public.accept_ride_request(
  p_request_id uuid,
  p_token_id uuid,
  p_driver_id uuid
) returns uuid language plpgsql set search_path = public as $$
declare
  v_request public.ride_requests%rowtype;
  v_token public.ride_tokens%rowtype;
  v_match_id uuid;
begin
  select * into v_request
    from public.ride_requests
    where id = p_request_id
    for update;
  if v_request.id is null then raise exception 'request_not_found'; end if;
  if v_request.status <> 'searching' then raise exception 'already_matched'; end if;
  if v_request.passenger_id = p_driver_id then raise exception 'self_match'; end if;

  select * into v_token
    from public.ride_tokens
    where id = p_token_id
    for update;
  if v_token.id is null
     or v_token.status <> 'live'
     or v_token.seats_left < 1 then
    raise exception 'token_unavailable';
  end if;
  if v_token.driver_id <> p_driver_id then raise exception 'driver_token_mismatch'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_driver_id and p.is_driver_verified
  ) then
    raise exception 'driver_not_verified';
  end if;
  if not exists (
    select 1 from public.request_targets rt
    where rt.request_id = p_request_id
      and rt.token_id = p_token_id
      and rt.driver_id = p_driver_id
      and rt.state = 'pending'
  ) then
    raise exception 'target_not_pending';
  end if;

  update public.ride_requests
    set status = 'matched', matched_token_id = p_token_id, matched_driver_id = p_driver_id
    where id = p_request_id;

  update public.request_targets
    set state = 'accepted'
    where request_id = p_request_id
      and token_id = p_token_id
      and driver_id = p_driver_id
      and state = 'pending';
  update public.request_targets
    set state = 'dismissed'
    where request_id = p_request_id
      and token_id <> p_token_id
      and state = 'pending';

  update public.ride_tokens
    set seats_left = seats_left - 1,
        status = case when seats_left - 1 <= 0 then 'matched' else status end
    where id = p_token_id;

  insert into public.matches (kind, ride_token_id, ride_request_id)
    values ('ride', p_token_id, p_request_id)
    returning id into v_match_id;

  insert into public.match_participants (match_id, profile_id, role) values
    (v_match_id, p_driver_id, 'driver'),
    (v_match_id, v_request.passenger_id, 'passenger');

  -- Push is best-effort; Realtime remains the source of truth.
  begin
    insert into public.notifications_outbox (profile_id, title, body, data)
    values (
      v_request.passenger_id,
      'Ride accepted 🎉',
      'A driver accepted your ride. Tap to see the details.',
      jsonb_build_object('type', 'match', 'matchId', v_match_id)
    );
  exception when others then
    raise warning 'accept_ride_request: notify enqueue failed: %', sqlerrm;
  end;

  return v_match_id;
end $$;

revoke execute on function public.accept_ride_request(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.accept_ride_request(uuid, uuid, uuid)
  to service_role;
