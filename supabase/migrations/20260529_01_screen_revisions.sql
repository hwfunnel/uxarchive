-- ============================================================
-- Phase 0-A: screen_revisions + screen_revision_checks 생성
-- 작성일: 2026-05-29
-- 목적: 화면 단위 버전 이력 + run별 수집 확인 기록
--       기존 screen_sets / screens / analysis_reports 변경 없음 (additive only)
--
-- Rollback:
--   DROP TABLE screen_revision_checks;
--   DROP TABLE screen_revisions;
-- ============================================================


-- ── Table 1: 실제 이미지 버전 이력 ──────────────────────────────
-- 이미지가 변경될 때만 row 추가 (unchanged / not_collected / failed는 row 없음)
CREATE TABLE screen_revisions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id        UUID        NOT NULL REFERENCES screens(id) ON DELETE RESTRICT,

  version_no       INT         NOT NULL,          -- 화면 단위 증가 (1, 2, 3…)

  imgsrc           TEXT        NOT NULL,           -- Storage 경로
  content_hash     TEXT        NOT NULL,           -- SHA-256
  source_url       TEXT,                           -- 캡처 원본 URL

  captured_at      TIMESTAMPTZ,                    -- 크롤러가 캡처한 시각
  uploaded_at      DATE        NOT NULL,           -- Supabase 업로드 날짜

  -- new: 이 화면 첫 수집
  -- changed: 이전 버전과 hash 다름
  -- presumed_gone: 연속 미수집으로 소멸 추정 (새 row 추가 아닌 status 업데이트)
  status           TEXT        NOT NULL,

  prev_revision_id UUID        REFERENCES screen_revisions(id),
  is_current       BOOLEAN     NOT NULL DEFAULT TRUE,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_sr_status CHECK (status IN ('new', 'changed', 'presumed_gone')),
  CONSTRAINT uq_sr_version  UNIQUE (screen_id, version_no)
);

-- screen당 is_current=true는 하나만
CREATE UNIQUE INDEX uq_screen_revision_current
  ON screen_revisions(screen_id)
  WHERE (is_current = TRUE);

CREATE INDEX idx_sr_screen_id   ON screen_revisions(screen_id);
CREATE INDEX idx_sr_uploaded_at ON screen_revisions(uploaded_at);
CREATE INDEX idx_sr_status      ON screen_revisions(status);


-- ── Table 2: 크롤링 run별 수집 확인 기록 ─────────────────────────
-- 매 run마다 모든 대상 화면에 대해 row 추가
CREATE TABLE screen_revision_checks (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id      UUID        NOT NULL REFERENCES screens(id) ON DELETE RESTRICT,
  revision_id    UUID        REFERENCES screen_revisions(id),
  -- revision_id nullable: 한 번도 수집된 적 없는 화면의 failed / not_collected

  crawl_run_id   TEXT        NOT NULL,
  checked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- new: 첫 수집
  -- changed: 이미지 변경
  -- unchanged: 이미지 동일
  -- not_collected: 이번 run에 미포함
  -- failed: 수집 오류
  status         TEXT        NOT NULL,

  content_hash   TEXT,          -- 확인 시점 hash (not_collected / failed는 NULL)
  source_url     TEXT,          -- 확인 대상 URL
  error_message  TEXT,          -- failed 시 오류 내용

  CONSTRAINT chk_src_status CHECK (status IN (
    'new', 'changed', 'unchanged', 'not_collected', 'failed'
  ))
);

CREATE INDEX idx_src_screen_checked ON screen_revision_checks(screen_id, checked_at DESC);
CREATE INDEX idx_src_run_id         ON screen_revision_checks(crawl_run_id);
CREATE INDEX idx_src_revision_id    ON screen_revision_checks(revision_id);
CREATE INDEX idx_src_status         ON screen_revision_checks(status);
