-- Migration: screen_options + screen_option_screens 재설계
-- 기존 잘못된 screen_type_options, screen_options 테이블 삭제 후
-- 화면별 옵션 그룹 + 연결 화면 구조로 교체

-- 기존 잘못된 테이블 삭제 (screen_options가 screen_type_options를 FK 참조하므로 순서 중요)
DROP TABLE IF EXISTS public.screen_options CASCADE;
DROP TABLE IF EXISTS public.screen_type_options CASCADE;

-- 화면별 옵션 그룹 (현재 화면에 속하는 라벨)
CREATE TABLE public.screen_options (
  id bigserial PRIMARY KEY,
  screen_id uuid NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_no integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_so_screen_id ON public.screen_options(screen_id);

-- 옵션 그룹 ↔ 연결 화면 junction 테이블
CREATE TABLE public.screen_option_screens (
  id bigserial PRIMARY KEY,
  screen_option_id bigint NOT NULL REFERENCES public.screen_options(id) ON DELETE CASCADE,
  linked_screen_id uuid NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
  order_no integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT screen_option_screens_unique UNIQUE(screen_option_id, linked_screen_id)
);

CREATE INDEX idx_sos_option_id ON public.screen_option_screens(screen_option_id);
CREATE INDEX idx_sos_linked_screen_id ON public.screen_option_screens(linked_screen_id);

GRANT ALL ON TABLE public.screen_options TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.screen_options_id_seq TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.screen_option_screens TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.screen_option_screens_id_seq TO anon, authenticated, service_role;
