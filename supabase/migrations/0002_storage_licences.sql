-- Licence uploads for the become-a-driver flow (specs/05-DRIVER-FLOW.md).
-- Private bucket; each user can only write/read files under a folder named after
-- their auth.uid(). The app uploads to `${auth_user_id}/licence-*.jpg`.

insert into storage.buckets (id, name, public)
values ('licences', 'licences', false)
on conflict (id) do nothing;

create policy "licences_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'licences' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "licences_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'licences' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- Admin: approve a driver manually (MVP — do this from the Supabase dashboard).
-- Find the pending row: select * from driver_verifications where status='pending';
-- Then, for that profile:
--
--   update driver_verifications set status='approved', reviewed_at=now() where id='<verification_id>';
--   update profiles set is_driver_verified=true where id='<profile_id>';
--
-- To reject instead:
--   update driver_verifications set status='rejected', reject_reason='<why>', reviewed_at=now() where id='<verification_id>';
-- ============================================================================
