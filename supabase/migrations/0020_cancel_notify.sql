-- Phase A push completeness: notify the OTHER participant when a matched ride is
-- cancelled (previously silent — they only found out via Realtime, so a
-- backgrounded user got nothing). This is 0008's cancel_match body reproduced
-- VERBATIM, with the ONLY change being a best-effort enqueue when a cancellation
-- actually occurs. Additive; logic unchanged. matchId is included so the
-- foreground handler can suppress it if the user is already on that match screen.
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

    if v_cancelled_id is not null then
      if v_match.ride_token_id is not null then
        update ride_tokens
          set seats_left = least(seats_total, seats_left + 1),
              status = case when status = 'matched' and depart_at > now() then 'live' else status end
          where id = v_match.ride_token_id;
      end if;

      begin
        insert into notifications_outbox (profile_id, title, body, data)
          select mp.profile_id, 'Ride cancelled',
                 case when mp.role = 'driver' then 'Your passenger cancelled the ride.'
                      else 'Your driver cancelled the ride.' end,
                 jsonb_build_object('type', 'ride_cancelled', 'role', mp.role, 'matchId', p_match_id)
          from match_participants mp
          where mp.match_id = p_match_id and mp.profile_id <> v_me;
      exception when others then
        raise warning 'cancel_match: notify enqueue failed: %', sqlerrm;
      end;
    end if;
  end if;
end $$;
