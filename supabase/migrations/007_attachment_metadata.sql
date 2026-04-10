-- post_attachments에 파일명·타입·크기 컬럼 추가
alter table public.post_attachments
  add column if not exists file_name text,
  add column if not exists file_type text,
  add column if not exists file_size integer;
