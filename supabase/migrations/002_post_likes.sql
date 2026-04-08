-- post_likes 테이블 생성
create table if not exists public.post_likes (
  post_id   uuid references public.posts(id) on delete cascade,
  user_id   uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

alter table public.post_likes enable row level security;

-- 누구나 좋아요 조회 가능, 본인 좋아요만 추가/삭제 가능
create policy "likes_select" on public.post_likes for select using (true);
create policy "likes_insert" on public.post_likes for insert with check (auth.uid() = user_id);
create policy "likes_delete" on public.post_likes for delete using (auth.uid() = user_id);
