-- 공지 카테고리 게시글은 admin만 작성/수정 가능
drop policy if exists "posts_insert_own" on posts;
drop policy if exists "posts_update_own" on posts;

create policy "posts_insert_own" on posts
  for insert with check (
    auth.uid() = user_id
    and (
      category <> '공지'
      or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    )
  );

create policy "posts_update_own" on posts
  for update using (
    auth.uid() = user_id
    and (
      category <> '공지'
      or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    )
  );
