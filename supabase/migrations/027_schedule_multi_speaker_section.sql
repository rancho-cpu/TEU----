-- 섹션 다중 선택: section_type → section_types text[]
-- 연사 다중: speaker_name/affiliation/title → speakers jsonb[]

alter table schedule_sessions
  add column section_types text[] not null default '{}',
  add column speakers jsonb not null default '[]';

-- 기존 데이터 마이그레이션
update schedule_sessions
set
  section_types = array[section_type],
  speakers = case
    when speaker_name is not null then
      jsonb_build_array(jsonb_build_object(
        'name', coalesce(speaker_name, ''),
        'affiliation', coalesce(speaker_affiliation, ''),
        'title', coalesce(speaker_title, '')
      ))
    else '[]'::jsonb
  end;

alter table schedule_sessions
  drop column section_type,
  drop column speaker_name,
  drop column speaker_affiliation,
  drop column speaker_title;
