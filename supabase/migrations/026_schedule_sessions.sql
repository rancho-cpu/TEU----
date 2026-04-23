create table schedule_sessions (
  id           uuid primary key default gen_random_uuid(),
  cohort_id    uuid references cohorts(id) on delete cascade not null,
  week_num     int not null,
  session_date date not null,
  location     text not null default '오프라인',
  start_time   time not null,
  end_time     time not null,
  section_type text not null,
  topic        text not null,
  speaker_name        text,
  speaker_affiliation text,
  speaker_title       text,
  order_index  int not null default 0,
  created_at   timestamptz default now()
);

alter table schedule_sessions enable row level security;

create policy "schedule_read" on schedule_sessions
  for select to authenticated using (true);

create policy "schedule_admin_write" on schedule_sessions
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
