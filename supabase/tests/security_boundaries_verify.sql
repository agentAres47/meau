-- Read-only verification for migration 0033. Run in the Supabase SQL editor
-- after applying the migration; every failed invariant raises an exception.

do $$
declare
  v_definition text;
  v_policy_check text;
begin
  if has_column_privilege('authenticated', 'public.profiles', 'is_driver_verified', 'UPDATE') then
    raise exception 'FAIL: authenticated may update is_driver_verified';
  end if;
  if has_column_privilege('authenticated', 'public.profiles', 'verified_amity', 'UPDATE') then
    raise exception 'FAIL: authenticated may update verified_amity';
  end if;
  if has_column_privilege('authenticated', 'public.profiles', 'auth_user_id', 'UPDATE') then
    raise exception 'FAIL: authenticated may update auth_user_id';
  end if;
  if not has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE') then
    raise exception 'FAIL: authenticated cannot update safe profile fields';
  end if;

  if has_table_privilege('authenticated', 'public.ride_requests', 'UPDATE') then
    raise exception 'FAIL: authenticated may directly update ride request state';
  end if;
  if has_table_privilege('authenticated', 'public.auto_pool_sessions', 'UPDATE') then
    raise exception 'FAIL: authenticated may directly update pool state';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.accept_ride_request(uuid,uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: authenticated may call accept_ride_request directly';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.accept_ride_request(uuid,uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: service_role cannot call accept_ride_request';
  end if;

  select pg_get_functiondef('public.cancel_request(uuid)'::regprocedure)
    into v_definition;
  if position('passenger_id = v_me' in v_definition) = 0 then
    raise exception 'FAIL: cancel_request ownership guard missing';
  end if;

  select pg_get_functiondef('public.cancel_pool_session(uuid)'::regprocedure)
    into v_definition;
  if position('profile_id = current_profile_id()' in v_definition) = 0 then
    raise exception 'FAIL: cancel_pool_session ownership guard missing';
  end if;

  select pg_get_functiondef(
    'public.accept_ride_request(uuid,uuid,uuid)'::regprocedure
  ) into v_definition;
  if position('v_token.driver_id <> p_driver_id' in v_definition) = 0
     or position('rt.state = ''pending''' in v_definition) = 0 then
    raise exception 'FAIL: accept_ride_request identity/target guards missing';
  end if;

  select with_check into v_policy_check
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ride_tokens'
      and policyname = 'ride_tokens_verified_insert';
  if v_policy_check is null or position('is_driver_verified' in v_policy_check) = 0 then
    raise exception 'FAIL: verified-driver ride token policy missing';
  end if;

  raise notice 'SECURITY BOUNDARIES VERIFIED';
end $$;
