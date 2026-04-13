-- profiles에 phone 컬럼 추가
alter table public.profiles
  add column if not exists phone text;
