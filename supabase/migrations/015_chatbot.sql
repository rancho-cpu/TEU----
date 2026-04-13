-- chatbot_faqs 테이블 생성
create table if not exists public.chatbot_faqs (
  id          uuid        default gen_random_uuid() primary key,
  cohort_id   uuid        references public.cohorts(id) on delete cascade not null,
  question    text        not null,
  answer      text        not null,
  keywords    text[]      not null default '{}',
  order_index int         not null default 0,
  created_at  timestamptz default now()
);

alter table public.chatbot_faqs enable row level security;

-- 모든 멤버 읽기 가능
create policy "chatbot_faqs_select"
  on public.chatbot_faqs for select
  using (true);

-- 관리자만 추가/수정/삭제
create policy "chatbot_faqs_admin_insert"
  on public.chatbot_faqs for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "chatbot_faqs_admin_update"
  on public.chatbot_faqs for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "chatbot_faqs_admin_delete"
  on public.chatbot_faqs for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
