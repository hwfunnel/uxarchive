-- Migration: Create AI analysis cache and report storage tables
-- Purpose: store reusable AI image analysis cache, dark pattern reports, and comparison reports.

create table if not exists public.ai_analysis_cache (
  id bigserial primary key,
  analysis_type text not null,
  cache_key text not null,
  image_ids text[] null,
  image_paths text[] null,
  prompt_hash text,
  prompt_version text,
  model text,
  summary text,
  result_json jsonb,
  result_markdown text,
  raw_response jsonb,
  status text not null default 'pending',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_analysis_cache
  add constraint ai_analysis_cache_unique_cache unique (analysis_type, cache_key);

create index if not exists idx_ai_analysis_cache_created_by on public.ai_analysis_cache (created_by);
create index if not exists idx_ai_analysis_cache_analysis_type on public.ai_analysis_cache (analysis_type);
create index if not exists idx_ai_analysis_cache_status on public.ai_analysis_cache (status);
create index if not exists idx_ai_analysis_cache_created_at on public.ai_analysis_cache (created_at);

-- analysis reports can be used for history, audit, and user-facing report retrieval.
create table if not exists public.analysis_reports (
  id bigserial primary key,
  analysis_type text not null,
  report_key text not null,
  cache_id bigint references public.ai_analysis_cache(id) on delete set null,
  image_ids text[] null,
  image_paths text[] null,
  prompt_hash text,
  prompt_version text,
  model text,
  summary text,
  result_json jsonb,
  result_markdown text,
  raw_response jsonb,
  status text not null default 'completed',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.analysis_reports
  add constraint analysis_reports_unique_key unique (analysis_type, report_key);

create index if not exists idx_analysis_reports_created_by on public.analysis_reports (created_by);
create index if not exists idx_analysis_reports_analysis_type on public.analysis_reports (analysis_type);
create index if not exists idx_analysis_reports_status on public.analysis_reports (status);
create index if not exists idx_analysis_reports_created_at on public.analysis_reports (created_at);
create index if not exists idx_analysis_reports_cache_id on public.analysis_reports (cache_id);

-- Minimal RLS policies for user-owned records.
alter table public.ai_analysis_cache enable row level security;
create policy "Cache owner access" on public.ai_analysis_cache
  for all
  using (created_by is not distinct from auth.uid())
  with check (created_by is not distinct from auth.uid());

alter table public.analysis_reports enable row level security;
create policy "Reports owner access" on public.analysis_reports
  for all
  using (created_by is not distinct from auth.uid())
  with check (created_by is not distinct from auth.uid());
