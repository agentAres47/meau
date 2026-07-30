-- 0021's my_ride_history() has always thrown on every call: its RETURNS
-- TABLE declares an output column named match_id, which is also usable as a
-- PL/pgSQL variable inside the function body. One subquery referenced
-- `match_participants.match_id` without an alias — "where match_id = m.id" —
-- which Postgres can't resolve (table column vs. the output param), throwing
-- 42702 ambiguous_column on every call. The two subqueries right above it
-- got this right (aliased as mp2); this one didn't. Client code silently
-- swallowed the error into an empty array, so every user's ride history
-- always showed "No rides yet" — this was never about who was signed in.
create or replace function my_ride_history()
returns table (
  match_id uuid, kind text,
  other_name text, other_photo text,
  origin_label text, dest_label text, fare int,
  route_code text, pool_size int,
  when_at timestamptz, completed boolean, i_rated boolean
) language plpgsql security definer set search_path = public as $$
declare v_me uuid := current_profile_id();
begin
  return query
  select
    m.id, m.kind,
    (select p2.full_name from match_participants mp2 join profiles p2 on p2.id = mp2.profile_id
       where mp2.match_id = m.id and mp2.profile_id <> v_me limit 1),
    (select p2.photo_url from match_participants mp2 join profiles p2 on p2.id = mp2.profile_id
       where mp2.match_id = m.id and mp2.profile_id <> v_me limit 1),
    coalesce(t.origin_label, ''), coalesce(t.dest_label, ''),
    coalesce(t.price_per_seat, r.offered_price),
    aps.route_code,
    (select count(*)::int from match_participants mp3 where mp3.match_id = m.id),
    coalesce(m.completed_at, m.created_at),
    (m.completed_at is not null),
    exists (select 1 from ratings ra where ra.match_id = m.id and ra.rater_id = v_me)
  from matches m
  join match_participants me on me.match_id = m.id and me.profile_id = v_me
  left join ride_tokens t on t.id = m.ride_token_id
  left join ride_requests r on r.id = m.ride_request_id
  left join auto_pool_sessions aps on aps.pool_group_id = m.pool_group_id and aps.profile_id = v_me
  where m.completed_at is not null
     or (r.id is not null and r.status = 'cancelled')
  order by coalesce(m.completed_at, m.created_at) desc
  limit 50;
end $$;
