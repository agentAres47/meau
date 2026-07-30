-- Admin: delete a user's account entirely. Same is_admin() guard as every
-- other admin RPC (0015). Deletes auth.users, which cascades to profiles
-- (0001) and from there through vehicles/ride_tokens/ride_requests/matches/
-- messages/etc (relies on 0027's cascade/set-null fixes -- run that first).
create or replace function admin_delete_profile(p_profile_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_auth_user_id uuid;
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  select auth_user_id into v_auth_user_id from profiles where id = p_profile_id;
  if v_auth_user_id is null then
    raise exception 'no profile found for id %', p_profile_id;
  end if;

  delete from auth.users where id = v_auth_user_id;
end $$;

grant execute on function admin_delete_profile(uuid) to authenticated;
