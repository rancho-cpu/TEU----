-- 설문 응답 수정 허용 (본인 응답만)
create policy "survey_responses_update_own"
  on public.survey_responses for update
  using (auth.uid() = user_id);
