alter table public.cohorts
  add column if not exists slido_url  text,
  add column if not exists kakao_url  text;
