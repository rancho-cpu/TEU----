-- 알림 발신자 컬럼 추가
alter table public.notifications
  add column if not exists sender_id uuid references public.profiles(id) on delete set null;
