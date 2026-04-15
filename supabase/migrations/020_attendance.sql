-- ============================================================
-- 출석 시스템 (Phase 1: 오프라인 QR 출석)
-- ============================================================

-- 출석 세션
create table if not exists public.attendance_sessions (
  id              uuid        primary key default gen_random_uuid(),
  cohort_id       uuid        not null references public.cohorts(id) on delete cascade,
  title           text        not null,
  type            text        not null default 'offline',
  session_date    date        not null,
  start_time      timestamptz not null,
  end_time        timestamptz not null,
  zoom_meeting_id text,
  created_at      timestamptz not null default now()
);

-- 오프라인 출석 기록
create table if not exists public.offline_attendance (
  id         uuid        primary key default gen_random_uuid(),
  session_id uuid        not null references public.attendance_sessions(id) on delete cascade,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  check_in   timestamptz,
  check_out  timestamptz,
  note       text,
  created_at timestamptz not null default now(),
  unique(session_id, user_id)
);

-- RLS 활성화
alter table public.attendance_sessions enable row level security;
alter table public.offline_attendance   enable row level security;

-- ── attendance_sessions 정책 ─────────────────────────────────

drop policy if exists "att_sess_select" on public.attendance_sessions;
create policy "att_sess_select" on public.attendance_sessions for select using (
  exists (
    select 1 from public.cohort_members
    where cohort_id = attendance_sessions.cohort_id and user_id = auth.uid()
  )
  or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "att_sess_insert" on public.attendance_sessions;
create policy "att_sess_insert" on public.attendance_sessions for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "att_sess_update" on public.attendance_sessions;
create policy "att_sess_update" on public.attendance_sessions for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "att_sess_delete" on public.attendance_sessions;
create policy "att_sess_delete" on public.attendance_sessions for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- ── offline_attendance 정책 ──────────────────────────────────
-- 본인 기록 + admin 조회
drop policy if exists "off_att_select" on public.offline_attendance;
create policy "off_att_select" on public.offline_attendance for select using (
  user_id = auth.uid()
  or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
-- insert/update/delete 는 API 서비스롤로만 처리 (RLS 우회)
