-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Cohorts (기수)
create table if not exists cohorts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,                -- e.g. "TEU MED 5기"
  program_name text not null default 'TEU MED',
  description text,
  created_at timestamptz not null default now()
);

-- User profiles (extends Supabase Auth)
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  name text,
  avatar_url text,
  role text not null default 'student' check (role in ('admin', 'student')),
  created_at timestamptz not null default now()
);

-- Cohort members
create table if not exists cohort_members (
  cohort_id uuid not null references cohorts on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (cohort_id, user_id)
);

-- Zoom lectures
create table if not exists zoom_lectures (
  id uuid primary key default uuid_generate_v4(),
  cohort_id uuid not null references cohorts on delete cascade,
  zoom_meeting_id text not null,
  title text not null,
  recording_url text,
  start_time timestamptz,
  duration integer,  -- seconds
  created_at timestamptz not null default now(),
  unique (cohort_id, zoom_meeting_id)
);

-- Surveys (만족도 조사)
create table if not exists surveys (
  id uuid primary key default uuid_generate_v4(),
  cohort_id uuid not null references cohorts on delete cascade,
  title text not null,
  description text,
  questions jsonb not null default '[]',
  deadline timestamptz,
  created_at timestamptz not null default now()
);

-- Survey responses
create table if not exists survey_responses (
  id uuid primary key default uuid_generate_v4(),
  survey_id uuid not null references surveys on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  responses jsonb not null default '{}',
  submitted_at timestamptz not null default now(),
  unique (survey_id, user_id)
);

-- Challenges (챌린지)
create table if not exists challenges (
  id uuid primary key default uuid_generate_v4(),
  cohort_id uuid not null references cohorts on delete cascade,
  title text not null,
  description text,
  emoji text default '🔥',
  start_at timestamptz not null default now(),
  end_at timestamptz not null,
  is_closed boolean not null default false,
  created_at timestamptz not null default now()
);

-- Challenge submissions
create table if not exists challenge_submissions (
  id uuid primary key default uuid_generate_v4(),
  challenge_id uuid not null references challenges on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  content text,
  submitted_at timestamptz not null default now(),
  unique (challenge_id, user_id)
);

-- Community posts
create table if not exists posts (
  id uuid primary key default uuid_generate_v4(),
  cohort_id uuid not null references cohorts on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  title text not null,
  content text not null,
  category text default '일반',
  created_at timestamptz not null default now()
);

-- Comments
create table if not exists comments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references posts on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- Shortcuts
create table if not exists shortcuts (
  id uuid primary key default uuid_generate_v4(),
  cohort_id uuid not null references cohorts on delete cascade,
  label text not null,
  url text not null,
  color text default '#6366f1',
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- RLS
alter table cohorts enable row level security;
alter table profiles enable row level security;
alter table cohort_members enable row level security;
alter table zoom_lectures enable row level security;
alter table surveys enable row level security;
alter table survey_responses enable row level security;
alter table challenges enable row level security;
alter table challenge_submissions enable row level security;
alter table posts enable row level security;
alter table comments enable row level security;
alter table shortcuts enable row level security;

-- Profiles: users can read all, update own
create policy "profiles_read_all" on profiles for select using (true);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- Cohorts: readable by all authenticated
create policy "cohorts_read" on cohorts for select to authenticated using (true);
create policy "cohorts_admin_write" on cohorts for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Cohort members
create policy "members_read" on cohort_members for select to authenticated using (true);
create policy "members_admin_write" on cohort_members for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Zoom lectures
create policy "zoom_read" on zoom_lectures for select to authenticated using (true);
create policy "zoom_admin_write" on zoom_lectures for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Surveys
create policy "surveys_read" on surveys for select to authenticated using (true);
create policy "surveys_admin_write" on surveys for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Survey responses
create policy "survey_responses_read_own" on survey_responses for select using (auth.uid() = user_id);
create policy "survey_responses_insert_own" on survey_responses for insert with check (auth.uid() = user_id);
create policy "survey_responses_admin_read" on survey_responses for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Challenges
create policy "challenges_read" on challenges for select to authenticated using (true);
create policy "challenges_admin_write" on challenges for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Challenge submissions
create policy "submissions_read_own" on challenge_submissions for select using (auth.uid() = user_id);
create policy "submissions_insert_own" on challenge_submissions for insert with check (auth.uid() = user_id);
create policy "submissions_admin_read" on challenge_submissions for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Posts
create policy "posts_read" on posts for select to authenticated using (true);
create policy "posts_insert_own" on posts for insert with check (auth.uid() = user_id);
create policy "posts_update_own" on posts for update using (auth.uid() = user_id);
create policy "posts_delete_own" on posts for delete using (auth.uid() = user_id);

-- Comments
create policy "comments_read" on comments for select to authenticated using (true);
create policy "comments_insert_own" on comments for insert with check (auth.uid() = user_id);
create policy "comments_delete_own" on comments for delete using (auth.uid() = user_id);

-- Shortcuts
create policy "shortcuts_read" on shortcuts for select to authenticated using (true);
create policy "shortcuts_admin_write" on shortcuts for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
