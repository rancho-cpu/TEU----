-- ============================================================
-- 과제 테이블
-- ============================================================
create table if not exists public.assignments (
  id          uuid primary key default gen_random_uuid(),
  cohort_id   uuid not null references public.cohorts(id) on delete cascade,
  title       text not null,
  description text,
  deadline    timestamptz,
  order_index integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.assignments enable row level security;
create policy "assignments_select" on public.assignments for select to authenticated using (true);
create policy "assignments_admin_write" on public.assignments for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- ============================================================
-- 과제 제출 테이블
-- ============================================================
create table if not exists public.assignment_submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  content       text,
  submitted_at  timestamptz not null default now(),
  unique(assignment_id, user_id)
);

alter table public.assignment_submissions enable row level security;
create policy "asub_select_own" on public.assignment_submissions for select using (auth.uid() = user_id);
create policy "asub_select_admin" on public.assignment_submissions for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "asub_insert" on public.assignment_submissions for insert with check (auth.uid() = user_id);
create policy "asub_update" on public.assignment_submissions for update using (auth.uid() = user_id);
create policy "asub_delete_own" on public.assignment_submissions for delete using (auth.uid() = user_id);

-- ============================================================
-- 과제 첨부파일 테이블
-- ============================================================
create table if not exists public.assignment_attachments (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.assignment_submissions(id) on delete cascade,
  storage_path  text not null,
  file_name     text,
  file_type     text,
  file_size     integer,
  created_at    timestamptz not null default now()
);

alter table public.assignment_attachments enable row level security;
create policy "aatt_select" on public.assignment_attachments for select to authenticated using (true);
create policy "aatt_insert" on public.assignment_attachments for insert with check (
  exists (select 1 from public.assignment_submissions where id = submission_id and user_id = auth.uid())
);
create policy "aatt_delete" on public.assignment_attachments for delete using (
  exists (select 1 from public.assignment_submissions where id = submission_id and user_id = auth.uid())
);

-- Storage 버킷
insert into storage.buckets (id, name, public)
values ('assignment-attachments', 'assignment-attachments', true)
on conflict (id) do nothing;

create policy "aatt_storage_select" on storage.objects for select using (bucket_id = 'assignment-attachments');
create policy "aatt_storage_insert" on storage.objects for insert with check (
  bucket_id = 'assignment-attachments' and auth.role() = 'authenticated'
);
create policy "aatt_storage_delete" on storage.objects for delete using (
  bucket_id = 'assignment-attachments' and auth.role() = 'authenticated'
);
