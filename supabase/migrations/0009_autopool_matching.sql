-- Phase 7 — Auto Pool (specs/07-AUTO-POOL.md)

do $$
begin
  alter publication supabase_realtime add table auto_pool_sessions;
exception when duplicate_object then null;
end $$;

-- Groups waiting auto_pool_sessions into pools and creates the matches +
-- match_participants rows. Called on a short interval by the matching
-- service (service role — this needs no security definer since the caller
-- already has full DB rights). Idempotent: FOR UPDATE SKIP LOCKED means two
-- overlapping calls can't double-group the same rows.
--
-- ponytail: target group size is 2 (match as soon as 2 are waiting) but
-- opportunistically takes up to 3 if that many are already sitting there
-- when this runs — it does not hold a match open waiting for a possible 3rd.
-- "Now" mode only considers sessions from the last 5 minutes (matches the
-- existing expire_stale_rows timeout for 'now' sessions).
create or replace function run_autopool_matching() returns void language plpgsql as $$
declare
  v_group record;
  v_ids uuid[];
  v_pool_id uuid;
  v_match_id uuid;
begin
  for v_group in
    select route_code
    from auto_pool_sessions
    where mode = 'now' and status = 'waiting' and created_at > now() - interval '5 minutes'
    group by route_code
    having count(*) >= 2
  loop
    loop
      select array_agg(id order by created_at) into v_ids from (
        select id from auto_pool_sessions
        where route_code = v_group.route_code and mode = 'now' and status = 'waiting'
          and created_at > now() - interval '5 minutes'
        order by created_at
        limit 3
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
    having count(*) >= 2
  loop
    loop
      select array_agg(id order by created_at) into v_ids from (
        select id from auto_pool_sessions
        where route_code = v_group.route_code and mode = 'scheduled'
          and slot_time = v_group.slot_time and status = 'waiting'
        order by created_at
        limit 3
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
