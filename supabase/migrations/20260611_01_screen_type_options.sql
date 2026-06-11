-- Migration: Screen type options management
-- 화면유형별 옵션 마스터 테이블 + 화면별 옵션 연결 테이블 추가
-- 기존 screens, screen_types 구조 변경 없음

create table if not exists public.screen_type_options (
  id bigserial primary key,
  screen_type_code text not null references public.screen_types(code) on delete cascade,
  name text not null,
  order_no integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid
);

create index if not exists idx_sto_screen_type_code on public.screen_type_options(screen_type_code);

create table if not exists public.screen_options (
  id bigserial primary key,
  screen_id uuid not null references public.screens(id) on delete cascade,
  option_id bigint not null references public.screen_type_options(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint screen_options_unique unique(screen_id, option_id)
);

create index if not exists idx_so_screen_id on public.screen_options(screen_id);

grant all on table public.screen_type_options to anon, authenticated, service_role;
grant all on sequence public.screen_type_options_id_seq to anon, authenticated, service_role;
grant all on table public.screen_options to anon, authenticated, service_role;
grant all on sequence public.screen_options_id_seq to anon, authenticated, service_role;
