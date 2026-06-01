-- screens 테이블에 content_hash 컬럼 추가
-- 크롤러가 이미지 변경 여부를 screen_revisions 조인 없이 직접 확인하기 위한 컬럼
-- 기존 row는 NULL → 크롤러가 다음 실행 시 변경된 것으로 처리 후 채워짐
ALTER TABLE screens ADD COLUMN IF NOT EXISTS content_hash TEXT;
