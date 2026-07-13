-- Fix RLS infinite recursion (42P17).
-- ride_requests' select policy referenced request_targets, whose select policy
-- referenced ride_requests → infinite loop (also match_participants referenced
-- itself). Break the cycles with SECURITY DEFINER helpers: they run as owner,
-- so the cross-table lookup does NOT re-trigger the other table's RLS.

create or replace function is_request_owner(p_request_id uuid)
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from ride_requests
    where id = p_request_id and passenger_id = current_profile_id()
  );
$$;

create or replace function is_targeted_driver(p_request_id uuid)
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from request_targets
    where request_id = p_request_id and driver_id = current_profile_id()
  );
$$;

create or replace function is_match_participant(p_match_id uuid)
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from match_participants
    where match_id = p_match_id and profile_id = current_profile_id()
  );
$$;

-- ride_requests <-> request_targets cycle
drop policy if exists "ride_requests_targeted_driver_select" on ride_requests;
create policy "ride_requests_targeted_driver_select" on ride_requests for select
  using (is_targeted_driver(id));

drop policy if exists "request_targets_passenger_select" on request_targets;
create policy "request_targets_passenger_select" on request_targets for select
  using (is_request_owner(request_id));

-- match_participants self-reference + messages/matches cross-references
drop policy if exists "match_participants_self_select" on match_participants;
create policy "match_participants_self_select" on match_participants for select
  using (is_match_participant(match_id));

drop policy if exists "matches_participant_select" on matches;
create policy "matches_participant_select" on matches for select
  using (is_match_participant(id));

drop policy if exists "messages_participant_select" on messages;
create policy "messages_participant_select" on messages for select
  using (is_match_participant(match_id));

drop policy if exists "messages_participant_insert" on messages;
create policy "messages_participant_insert" on messages for insert
  with check (sender_id = current_profile_id() and is_match_participant(match_id));
