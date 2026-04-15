-- Zoom 이름 → 플랫폼 유저 매핑 (한 번 설정 후 재사용)
create table if not exists public.zoom_name_mappings (
  id         uuid        primary key default gen_random_uuid(),
  cohort_id  uuid        not null references public.cohorts(id) on delete cascade,
  zoom_name  text        not null,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(cohort_id, zoom_name)
);

alter table public.zoom_name_mappings enable row level security;

drop policy if exists "zoom_mappings_admin" on public.zoom_name_mappings;
create policy "zoom_mappings_admin" on public.zoom_name_mappings
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
