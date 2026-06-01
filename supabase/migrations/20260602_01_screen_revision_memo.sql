-- screen_revisions 테이블에 memo 컬럼 추가 (버전별 간단 메모)
ALTER TABLE screen_revisions ADD COLUMN IF NOT EXISTS memo TEXT;
