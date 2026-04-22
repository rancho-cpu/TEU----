-- 프로필 확장: 관심 분야, LinkedIn URL 추가
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
