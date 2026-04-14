-- 알림 시스템
create table if not exists public.notifications (
  id          uuid        default gen_random_uuid() primary key,
  cohort_id   uuid        references public.cohorts(id) on delete cascade not null,
  user_id     uuid        references auth.users(id) on delete cascade not null,
  title       text        not null,
  body        text,
  type        text        not null default 'manual',  -- 'manual' | 'deadline'
  related_id  uuid,       -- deadline 타입이면 assignment_id
  is_read     boolean     not null default false,
  created_at  timestamptz default now()
);

alter table public.notifications enable row level security;

-- 본인 알림만 조회 가능
create policy "notifications_select_own"
  on public.notifications for select
  using (user_id = auth.uid());

-- 본인 알림 읽음 처리 가능
create policy "notifications_update_own"
  on public.notifications for update
  using (user_id = auth.uid());

-- insert는 service role만 (서버사이드 createAdminClient 사용, RLS bypass)

-- 인덱스 (빠른 조회)
create index if not exists notifications_user_cohort_idx
  on public.notifications (user_id, cohort_id, created_at desc);
