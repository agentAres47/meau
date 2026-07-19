-- Phase 1 (F7) — push notifications, part 2: enqueue at the transition points.
--
-- Three sources write notifications_outbox. None of them notify the ACTOR (the
-- person who caused the event) — only the counterparties. All are additive;
-- existing behavior (matching, chat, accept) is unchanged apart from the extra
-- enqueue.

-- ============================================================================
-- 1. Driver accepts -> notify the PASSENGER. (Actor = driver, so driver isn't
--    notified.) This redefinition is identical to 0006_accept_self_safe.sql
--    except for the single INSERT into notifications_outbox before RETURN.
-- ============================================================================
create or replace function accept_ride_request(
  p_request_id uuid,
  p_token_id uuid,
  p_driver_id uuid
) returns uuid language plpgsql as $$
declare
  v_request ride_requests%rowtype;
  v_token ride_tokens%rowtype;
  v_passenger_id uuid;
  v_match_id uuid;
begin
  select * into v_request from ride_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'request_not_found'; end if;
  if v_request.status <> 'searching' then raise exception 'already_matched'; end if;

  select * into v_token from ride_tokens where id = p_token_id for update;
  if v_token.id is null or v_token.seats_left < 1 then raise exception 'token_unavailable'; end if;

  v_passenger_id := v_request.passenger_id;

  update ride_requests
    set status = 'matched', matched_token_id = p_token_id, matched_driver_id = p_driver_id
    where id = p_request_id;

  update request_targets set state = 'accepted'
    where request_id = p_request_id and token_id = p_token_id;
  update request_targets set state = 'dismissed'
    where request_id = p_request_id and token_id <> p_token_id and state = 'pending';

  update ride_tokens
    set seats_left = seats_left - 1,
        status = case when seats_left - 1 <= 0 then 'matched' else status end
    where id = p_token_id;

  insert into matches (kind, ride_token_id, ride_request_id)
    values ('ride', p_token_id, p_request_id)
    returning id into v_match_id;

  insert into match_participants (match_id, profile_id, role) values
    (v_match_id, p_driver_id, 'driver'),
    (v_match_id, v_passenger_id, 'passenger')
  on conflict (match_id, profile_id) do nothing;

  -- F7: tell the passenger. Skip when driver == passenger (solo self-match test).
  -- Best-effort: a notification enqueue failure must NEVER roll back the accept.
  begin
    if p_driver_id <> v_passenger_id then
      insert into notifications_outbox (profile_id, title, body, data)
      values (
        v_passenger_id,
        'Ride accepted 🎉',
        'A driver accepted your ride. Tap to see the details.',
        jsonb_build_object('type', 'match', 'matchId', v_match_id)
      );
    end if;
  exception when others then
    raise warning 'accept_ride_request: notify enqueue failed: %', sqlerrm;
  end;

  return v_match_id;
end;
$$;

-- ============================================================================
-- 2. New chat message -> notify the OTHER participant(s). Works for 1:1 and
--    autopool group chats (any participant that isn't the sender). System
--    summaries (kind='system') are skipped. SECURITY DEFINER because the insert
--    is triggered by a normal authenticated user, who has no RLS rights on
--    notifications_outbox.
-- ============================================================================
create or replace function notify_on_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'system' then
    return new;
  end if;

  -- Best-effort: never let a notification enqueue failure fail the message send.
  begin
    insert into notifications_outbox (profile_id, title, body, data)
    select
      mp.profile_id,
      coalesce(sender.full_name, 'New message'),
      left(new.body, 140),
      jsonb_build_object('type', 'chat', 'matchId', new.match_id)
    from match_participants mp
    join profiles sender on sender.id = new.sender_id
    where mp.match_id = new.match_id
      and mp.profile_id <> new.sender_id;
  exception when others then
    raise warning 'notify_on_message: enqueue failed: %', sqlerrm;
  end;

  return new;
end $$;

-- ponytail: one push per message. If busy chats get noisy, collapse/rate-limit
-- later (MVP_FEATURE_SPEC F7 edge case) — not needed at launch volumes.
create trigger notify_on_message_trg
  after insert on messages
  for each row execute function notify_on_message();

-- ============================================================================
-- 3. A passenger's request targets a driver -> notify that DRIVER. This is the
--    core-loop push (a driver who isn't watching the Driver tab now learns a
--    request arrived — the gap CURRENT_PRODUCT_STATE flagged). request_targets
--    are inserted by the matching service (service role); trigger keeps it in
--    the DB so it fires no matter how the row is created.
-- ============================================================================
create or replace function notify_on_request_target() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Best-effort: never let a notification enqueue failure fail the request fan-out.
  begin
    insert into notifications_outbox (profile_id, title, body, data)
    values (
      new.driver_id,
      'New ride request',
      'A passenger wants to ride with you. Tap to view.',
      jsonb_build_object('type', 'driver_incoming', 'request_id', new.request_id)
    );
  exception when others then
    raise warning 'notify_on_request_target: enqueue failed: %', sqlerrm;
  end;
  return new;
end $$;

create trigger notify_on_request_target_trg
  after insert on request_targets
  for each row execute function notify_on_request_target();
