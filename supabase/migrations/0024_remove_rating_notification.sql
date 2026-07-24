-- Ratings/feedback removed from the app (the post-ride rate screen and its
-- navigation were never reliable). end_ride() still marks the ride completed
-- -- that's still needed so the ride/matched and autopool chat screens know to
-- leave -- but it no longer enqueues a "tap to rate" push, since there's
-- nothing left for that notification to deep-link to.
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
end $$;

-- submit_rating() and the ratings table are left in place, inert (no client
-- calls them anymore) -- not dropped, since that's a separate, non-urgent,
-- more destructive decision than removing the app-side flow.
