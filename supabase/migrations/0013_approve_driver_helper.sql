-- One-line admin helpers for the manual driver-approval workflow (see
-- 0002_storage_licences.sql) -- keyed by amizone_id instead of hunting down
-- the verification_id/profile_id UUIDs by hand.
--
-- Usage from the SQL editor:
--   select approve_driver('<amizone_id>');
--   select reject_driver('<amizone_id>', 'blurry photo');   -- reason optional
--
-- Explicitly NOT exposed to the app (revoked below) -- these run with the
-- SQL editor's full postgres privileges and must never be callable by a
-- regular user, or anyone could approve themselves as a driver via RPC.

create or replace function approve_driver(p_amizone_id text) returns void
language plpgsql as $$
declare
  v_profile_id uuid;
begin
  select id into v_profile_id from profiles where amizone_id = p_amizone_id;
  if v_profile_id is null then
    raise exception 'no profile found for amizone_id %', p_amizone_id;
  end if;

  update driver_verifications set status = 'approved', reviewed_at = now()
    where profile_id = v_profile_id and status = 'pending';

  update profiles set is_driver_verified = true where id = v_profile_id;
end $$;

create or replace function reject_driver(p_amizone_id text, p_reason text default null) returns void
language plpgsql as $$
declare
  v_profile_id uuid;
begin
  select id into v_profile_id from profiles where amizone_id = p_amizone_id;
  if v_profile_id is null then
    raise exception 'no profile found for amizone_id %', p_amizone_id;
  end if;

  update driver_verifications set status = 'rejected', reject_reason = p_reason, reviewed_at = now()
    where profile_id = v_profile_id and status = 'pending';
end $$;

revoke execute on function approve_driver(text) from public, anon, authenticated;
revoke execute on function reject_driver(text, text) from public, anon, authenticated;
