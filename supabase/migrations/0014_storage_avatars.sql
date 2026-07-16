-- Profile photo uploads (Phase C signup enrichment). Public bucket — avatars
-- aren't sensitive, and public-read URLs are simplest for rendering across
-- the app. Writes are still owner-scoped, same shape as licences.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_select_public" on storage.objects for select to public
  using (bucket_id = 'avatars');
