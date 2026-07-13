-- Fix: run_autopool_matching (0009) could pick 2+ waiting rows from the SAME
-- profile into one pool (e.g. stale duplicate sessions from repeated
-- retries) -- inserting that group into match_participants then violates
-- its unique(match_id, profile_id) constraint, silently failing that
-- route's grouping attempt every tick with no visible progress. Now picks
-- at most one (the oldest) waiting session per distinct profile before
-- claiming a batch, so a pool can never contain the same person twice.

create or replace function run_autopool_matching() returns void language plpgsql as $$
declare
  v_group record;
  v_candidate_ids uuid[];
  v_ids uuid[];
  v_pool_id uuid;
  v_match_id uuid;
begin
  for v_group in
    select route_code
    from auto_pool_sessions
    where mode = 'now' and status = 'waiting' and created_at > now() - interval '5 minutes'
    group by route_code
    having count(distinct profile_id) >= 2
  loop
    loop
      select array_agg(id) into v_candidate_ids from (
        select distinct on (profile_id) id, created_at
        from auto_pool_sessions
        where route_code = v_group.route_code and mode = 'now' and status = 'waiting'
          and created_at > now() - interval '5 minutes'
        order by profile_id, created_at
      ) per_profile
      order by created_at
      limit 3;

      exit when v_candidate_ids is null or array_length(v_candidate_ids, 1) < 2;

      select array_agg(id order by created_at) into v_ids from (
        select id from auto_pool_sessions
        where id = any(v_candidate_ids) and status = 'waiting'
        order by created_at
        for update skip locked
      ) s;

      exit when v_ids is null or array_length(v_ids, 1) < 2;

      v_pool_id := uuid_generate_v4();
      update auto_pool_sessions set status = 'matched', pool_group_id = v_pool_id where id = any(v_ids);

      insert into matches (kind, pool_group_id) values ('autopool', v_pool_id) returning id into v_match_id;
      insert into match_participants (match_id, profile_id, role)
        select v_match_id, profile_id, 'pooler' from auto_pool_sessions where id = any(v_ids);
    end loop;
  end loop;

  for v_group in
    select route_code, slot_time
    from auto_pool_sessions
    where mode = 'scheduled' and status = 'waiting'
    group by route_code, slot_time
    having count(distinct profile_id) >= 2
  loop
    loop
      select array_agg(id) into v_candidate_ids from (
        select distinct on (profile_id) id, created_at
        from auto_pool_sessions
        where route_code = v_group.route_code and mode = 'scheduled'
          and slot_time = v_group.slot_time and status = 'waiting'
        order by profile_id, created_at
      ) per_profile
      order by created_at
      limit 3;

      exit when v_candidate_ids is null or array_length(v_candidate_ids, 1) < 2;

      select array_agg(id order by created_at) into v_ids from (
        select id from auto_pool_sessions
        where id = any(v_candidate_ids) and status = 'waiting'
        order by created_at
        for update skip locked
      ) s;

      exit when v_ids is null or array_length(v_ids, 1) < 2;

      v_pool_id := uuid_generate_v4();
      update auto_pool_sessions set status = 'matched', pool_group_id = v_pool_id where id = any(v_ids);

      insert into matches (kind, pool_group_id) values ('autopool', v_pool_id) returning id into v_match_id;
      insert into match_participants (match_id, profile_id, role)
        select v_match_id, profile_id, 'pooler' from auto_pool_sessions where id = any(v_ids);
    end loop;
  end loop;
end $$;

-- One-off cleanup: cancel the stale 'waiting' test rows piled up while
-- debugging so the next test starts clean. Safe to run once.
update auto_pool_sessions set status = 'cancelled'
  where status = 'waiting' and created_at < now() - interval '2 minutes';
