-- survey_responses upsert (update) 허용
create policy if not exists "survey_responses_update_own" on public.survey_responses
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
