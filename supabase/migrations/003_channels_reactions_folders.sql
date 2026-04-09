-- ============================================================
-- 채널 테이블 (커뮤니티 채널 구분)
-- ============================================================
create table if not exists public.channels (
  id          uuid primary key default gen_random_uuid(),
  cohort_id   uuid not null references public.cohorts(id) on delete cascade,
  name        text not null,
  description text,
  order_index integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.channels enable row level security;
create policy "channels_select" on public.channels for select using (true);
create policy "channels_insert" on public.channels for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "channels_update" on public.channels for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "channels_delete" on public.channels for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- ============================================================
-- 게시글 반응 테이블 (관심있어요=star, 짝짝=clap)
-- ============================================================
create table if not exists public.post_reactions (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null check (type in ('star', 'clap')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, type)
);

alter table public.post_reactions enable row level security;
create policy "reactions_select" on public.post_reactions for select using (true);
create policy "reactions_insert" on public.post_reactions for insert with check (auth.uid() = user_id);
create policy "reactions_delete" on public.post_reactions for delete using (auth.uid() = user_id);

-- ============================================================
-- 콘텐츠 폴더 테이블
-- ============================================================
create table if not exists public.content_folders (
  id          uuid primary key default gen_random_uuid(),
  cohort_id   uuid not null references public.cohorts(id) on delete cascade,
  name        text not null,
  order_index integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.content_folders enable row level security;
create policy "folders_select" on public.content_folders for select using (true);
create policy "folders_insert" on public.content_folders for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "folders_update" on public.content_folders for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "folders_delete" on public.content_folders for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- ============================================================
-- posts 테이블에 컬럼 추가
-- ============================================================
alter table public.posts
  add column if not exists channel_id uuid references public.channels(id) on delete set null,
  add column if not exists is_pinned  boolean not null default false,
  add column if not exists type       text    not null default 'general'
    check (type in ('general', 'notice'));

-- ============================================================
-- zoom_lectures / surveys 에 folder_id 추가
-- ============================================================
alter table public.zoom_lectures
  add column if not exists folder_id uuid references public.content_folders(id) on delete set null;

alter table public.surveys
  add column if not exists folder_id uuid references public.content_folders(id) on delete set null;
