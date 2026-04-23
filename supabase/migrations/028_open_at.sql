-- 과제/설문에 시작일(open_at) 추가
-- open_at <= now() 이고 is_published = false 인 항목을 cron으로 자동 공개 전환

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS open_at timestamptz;
ALTER TABLE surveys     ADD COLUMN IF NOT EXISTS open_at timestamptz;
