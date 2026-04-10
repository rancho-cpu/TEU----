-- ============================================================
-- 게시글 이미지 첨부 테이블
-- ============================================================
create table if not exists public.post_attachments (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts(id) on delete cascade,
  storage_path text not null,
  created_at   timestamptz not null default now()
);

alter table public.post_attachments enable row level security;
create policy "attachments_select" on public.post_attachments for select to authenticated using (true);
create policy "attachments_insert" on public.post_attachments for insert with check (
  exists (select 1 from public.posts where id = post_id and user_id = auth.uid())
);
create policy "attachments_delete" on public.post_attachments for delete using (
  exists (select 1 from public.posts where id = post_id and (user_id = auth.uid() or
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')))
);

-- ============================================================
-- Storage 버킷 (post-attachments)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('post-attachments', 'post-attachments', true)
on conflict (id) do nothing;

create policy "post_att_select"  on storage.objects for select using (bucket_id = 'post-attachments');
create policy "post_att_insert"  on storage.objects for insert with check (
  bucket_id = 'post-attachments' and auth.role() = 'authenticated'
);
create policy "post_att_delete"  on storage.objects for delete using (
  bucket_id = 'post-attachments' and auth.role() = 'authenticated'
);
