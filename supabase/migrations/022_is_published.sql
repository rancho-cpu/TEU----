-- 과제/설문 공개 여부 컬럼 추가
alter table public.assignments add column if not exists is_published boolean not null default false;
alter table public.surveys     add column if not exists is_published boolean not null default false;
