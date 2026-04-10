-- ============================================================
-- 사진 게시판 테이블
-- ============================================================
create table if not exists public.photos (
  id          uuid primary key default gen_random_uuid(),
  cohort_id   uuid not null references public.cohorts(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,          -- supabase storage 경로
  caption     text,
  created_at  timestamptz not null default now()
);

alter table public.photos enable row level security;

create policy "photos_select"  on public.photos for select to authenticated using (true);
create policy "photos_insert"  on public.photos for insert with check (auth.uid() = user_id);
create policy "photos_delete_own" on public.photos for delete using (auth.uid() = user_id);
create policy "photos_delete_admin" on public.photos for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- ============================================================
-- Supabase Storage 버킷 생성 (이미 있으면 무시)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- Storage RLS
create policy "photos_storage_select" on storage.objects for select using (bucket_id = 'photos');
create policy "photos_storage_insert" on storage.objects for insert with check (
  bucket_id = 'photos' and auth.role() = 'authenticated'
);
create policy "photos_storage_delete_own" on storage.objects for delete using (
  bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[2]
);
create policy "photos_storage_delete_admin" on storage.objects for delete using (
  bucket_id = 'photos' and exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  )
);
