-- Leaving an autopool chat disbands that pool: the leaver's session is
-- cancelled, everyone else's session goes straight back to 'waiting' (same
-- row, same route/mode/slot_time -- no re-picking) so they resume
-- searching immediately. Ride matches use their own cancel_match (0008)
-- instead; this one is autopool-only.

alter table matches add column if not exists status text not null default 'active'
  check (status in ('active', 'disbanded'));

do $$
begin
  alter publication supabase_realtime add table matches;
exception when duplicate_object then null;
end $$;

create or replace function leave_autopool(p_match_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := current_profile_id();
  v_match matches%rowtype;
begin
  select * into v_match from matches where id = p_match_id;
  if v_match.id is null then
    raise exception 'match_not_found';
  end if;
  if v_match.kind <> 'autopool' then
    raise exception 'not_autopool';
  end if;

  if not exists (
    select 1 from match_participants where match_id = p_match_id and profile_id = v_me
  ) then
    raise exception 'not_a_participant';
  end if;

  if v_match.status = 'disbanded' then
    return; -- already left by someone else; nothing more to do
  end if;

  update matches set status = 'disbanded' where id = p_match_id;

  update auto_pool_sessions set status = 'cancelled'
    where pool_group_id = v_match.pool_group_id and profile_id = v_me;

  update auto_pool_sessions set status = 'waiting', pool_group_id = null
    where pool_group_id = v_match.pool_group_id and profile_id <> v_me;
end $$;
