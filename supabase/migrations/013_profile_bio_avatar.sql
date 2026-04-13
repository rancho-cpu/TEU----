-- profiles에 bio 컬럼 추가
alter table public.profiles
  add column if not exists bio text;

-- profiles update WITH CHECK 보강
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- 아바타 스토리지 버킷
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_select" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and auth.role() = 'authenticated'
  );

create policy "avatars_update" on storage.objects
  for update using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_delete" on storage.objects
  for delete using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );
