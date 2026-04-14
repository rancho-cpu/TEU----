-- 강연 자료 방
create table if not exists public.materials (
  id          uuid        default gen_random_uuid() primary key,
  cohort_id   uuid        references public.cohorts(id) on delete cascade not null,
  user_id     uuid        references auth.users(id) on delete set null,
  title       text        not null,
  content     text,
  created_at  timestamptz default now()
);

create table if not exists public.material_attachments (
  id            uuid        default gen_random_uuid() primary key,
  material_id   uuid        references public.materials(id) on delete cascade not null,
  storage_path  text        not null,
  file_name     text,
  file_type     text,
  file_size     bigint,
  created_at    timestamptz default now()
);

alter table public.materials enable row level security;
alter table public.material_attachments enable row level security;

-- 멤버 전체 조회 가능
create policy "materials_select"
  on public.materials for select using (true);

create policy "material_attachments_select"
  on public.material_attachments for select using (true);

-- 관리자만 등록/수정/삭제
create policy "materials_admin_insert"
  on public.materials for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "materials_admin_update"
  on public.materials for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "materials_admin_delete"
  on public.materials for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "material_attachments_admin_insert"
  on public.material_attachments for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "material_attachments_admin_delete"
  on public.material_attachments for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Storage bucket
insert into storage.buckets (id, name, public)
  values ('materials', 'materials', true)
  on conflict (id) do nothing;

create policy "materials_storage_select"
  on storage.objects for select
  using (bucket_id = 'materials');

create policy "materials_storage_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'materials' and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "materials_storage_delete"
  on storage.objects for delete
  using (
    bucket_id = 'materials' and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
