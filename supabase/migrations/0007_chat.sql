-- Phase 6 — In-app chat (specs/10-CHAT.md)

-- One system summary message per match. Makes the client "insert if empty"
-- idempotent under a race (both participants open at once → second insert 23505s).
create unique index if not exists messages_one_system_per_match
  on messages (match_id) where kind = 'system';

-- Chat header + system-summary data for a match, in one round-trip.
-- security definer: a passenger can't read the driver's ride_token (RLS), and
-- vice-versa, so we bypass RLS here but gate on participation first.
-- Returns the OTHER participant (falls back to self for a solo self-match, which
-- only happens in one-device testing).
create or replace function match_chat_meta(p_match_id uuid)
returns table (
  kind text, other_id uuid, other_name text, other_photo text, other_role text,
  origin_label text, dest_label text, depart_at timestamptz, price_per_seat int
) language plpgsql security definer set search_path = public as $$
declare v_me uuid := current_profile_id();
begin
  if not exists (
    select 1 from match_participants where match_id = p_match_id and profile_id = v_me
  ) then
    raise exception 'not_a_participant';
  end if;

  return query
  select m.kind, mp.profile_id, p.full_name, p.photo_url, mp.role,
         t.origin_label, t.dest_label, t.depart_at, t.price_per_seat
  from matches m
  join match_participants mp on mp.match_id = m.id
  join profiles p on p.id = mp.profile_id
  left join ride_tokens t on t.id = m.ride_token_id
  where m.id = p_match_id
  order by (mp.profile_id <> v_me) desc
  limit 1;
end $$;
