-- Redefine accept_ride_request so a self-match (same profile as driver AND
-- passenger, e.g. solo device testing) doesn't fail on the match_participants
-- unique(match_id, profile_id) constraint. `on conflict do nothing` inserts one
-- participant instead of erroring; unchanged for real driver/passenger pairs.

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

  return v_match_id;
end;
$$;
