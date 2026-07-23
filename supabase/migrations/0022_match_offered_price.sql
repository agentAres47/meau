-- #13 — the passenger picks the price last, so their offered price is the final,
-- agreed fare. It lives on ride_requests.offered_price but the matched screen was
-- showing the driver's token price instead. Expose the offered price to both
-- participants of a match.
--
-- Additive + safe: a new security-definer function (same access pattern as
-- incoming_request_detail), so the already-working match_status is left alone.
create or replace function match_offered_price(p_match_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_me uuid := current_profile_id();
begin
  -- Only a participant of this match may read its fare.
  if not exists (
    select 1 from match_participants where match_id = p_match_id and profile_id = v_me
  ) then
    return null;
  end if;

  return (
    select r.offered_price
    from matches m
    join ride_requests r on r.id = m.ride_request_id
    where m.id = p_match_id
  );
end $$;
