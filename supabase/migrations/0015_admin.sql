-- Phase D: admin support -- is_admin() helper plus guarded RPCs for the admin
-- dashboard, and re-granting approve_driver/reject_driver behind an is_admin()
-- check. Admin is a real Supabase Auth user (created manually in the
-- dashboard, see REDESIGN_PLAN), never a `profiles` row -- profiles are
-- reserved for verified Amity members.
--
-- Deliberately NOT adding broad is_admin()-based SELECT policies across
-- driver_verifications/vehicles/ride_tokens/matches -- that would let any
-- admin session run arbitrary selects against those tables via PostgREST.
-- Instead, admin reads go through specific SECURITY DEFINER RPCs below,
-- matching the existing approve_driver/reject_driver pattern: guard inside
-- the function, never rely on client-side gating alone (the APK can be
-- decompiled).

create table admins (
  auth_user_id uuid primary key references auth.users(id) on delete cascade
);
alter table admins enable row level security;
-- No policies at all -- nobody, including admins, can read/write this table
-- via the API. Membership is granted manually in the SQL editor:
--   insert into admins (auth_user_id) values ('<uuid from auth.users>');

create or replace function is_admin() returns boolean language sql stable as $$
  select exists (select 1 from admins where auth_user_id = auth.uid())
$$;
grant execute on function is_admin() to authenticated;

-- Re-guard approve_driver/reject_driver: now callable by any authenticated
-- session, but raise unless the caller is an admin.
create or replace function approve_driver(p_amizone_id text) returns void
language plpgsql security definer as $$
declare
  v_profile_id uuid;
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  select id into v_profile_id from profiles where amizone_id = p_amizone_id;
  if v_profile_id is null then
    raise exception 'no profile found for amizone_id %', p_amizone_id;
  end if;

  update driver_verifications set status = 'approved', reviewed_at = now()
    where profile_id = v_profile_id and status = 'pending';

  update profiles set is_driver_verified = true where id = v_profile_id;
end $$;

create or replace function reject_driver(p_amizone_id text, p_reason text default null) returns void
language plpgsql security definer as $$
declare
  v_profile_id uuid;
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  select id into v_profile_id from profiles where amizone_id = p_amizone_id;
  if v_profile_id is null then
    raise exception 'no profile found for amizone_id %', p_amizone_id;
  end if;

  update driver_verifications set status = 'rejected', reject_reason = p_reason, reviewed_at = now()
    where profile_id = v_profile_id and status = 'pending';
end $$;

grant execute on function approve_driver(text) to authenticated;
grant execute on function reject_driver(text, text) to authenticated;

-- Pending driver applications queue, joined with profile + vehicle info.
create or replace function admin_pending_driver_applications()
returns table (
  verification_id uuid,
  profile_id uuid,
  amizone_id text,
  full_name text,
  phone text,
  vehicle_type text,
  make_model text,
  color text,
  plate_number text,
  seats int,
  licence_path text,
  created_at timestamptz
) language plpgsql security definer as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  return query
    select dv.id, p.id, p.amizone_id, p.full_name, p.phone,
           v.type, v.make_model, v.color, v.plate_number, v.seats,
           dv.licence_image_url, dv.created_at
    from driver_verifications dv
    join profiles p on p.id = dv.profile_id
    left join vehicles v on v.owner_id = p.id
    where dv.status = 'pending'
    order by dv.created_at asc;
end $$;

grant execute on function admin_pending_driver_applications() to authenticated;

-- Full user list for the admin dashboard.
create or replace function admin_list_profiles()
returns table (
  id uuid,
  amizone_id text,
  full_name text,
  role text,
  phone text,
  is_driver_verified boolean,
  created_at timestamptz
) language plpgsql security definer as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  return query
    select p.id, p.amizone_id, p.full_name, p.role, p.phone, p.is_driver_verified, p.created_at
    from profiles p
    order by p.created_at desc;
end $$;

grant execute on function admin_list_profiles() to authenticated;

-- Simple usage counts for the dashboard overview. Deeper analytics (charts
-- over time, per-route volume) is explicitly a later extension, not this pass.
create or replace function admin_stats()
returns table (
  total_users bigint,
  onboarded_users bigint,
  pending_driver_applications bigint,
  active_ride_tokens bigint,
  rides_today bigint
) language plpgsql security definer as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  return query select
    (select count(*) from profiles),
    (select count(*) from profiles where phone is not null),
    (select count(*) from driver_verifications where status = 'pending'),
    (select count(*) from ride_tokens where status = 'live'),
    (select count(*) from matches where kind = 'ride' and created_at >= current_date);
end $$;

grant execute on function admin_stats() to authenticated;

-- Admin needs to view licence photos for review (bucket is private, owner-only by default).
create policy "licences_select_admin" on storage.objects for select to authenticated
  using (bucket_id = 'licences' and is_admin());
