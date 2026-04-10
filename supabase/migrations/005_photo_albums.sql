-- ============================================================
-- 사진 앨범(행사) 테이블
-- ============================================================
create table if not exists public.photo_albums (
  id          uuid primary key default gen_random_uuid(),
  cohort_id   uuid not null references public.cohorts(id) on delete cascade,
  name        text not null,
  description text,
  cover_path  text,                 -- 대표 사진 storage 경로
  order_index integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.photo_albums enable row level security;
create policy "albums_select" on public.photo_albums for select to authenticated using (true);
create policy "albums_admin_write" on public.photo_albums for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- ============================================================
-- photos 테이블에 album_id 컬럼 추가
-- ============================================================
alter table public.photos
  add column if not exists album_id uuid references public.photo_albums(id) on delete set null;
