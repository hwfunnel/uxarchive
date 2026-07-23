delete from public.analysis_reports
where analysis_type = 'darkpattern';

create table if not exists public.dp_audit_reports (
  id text primary key,
  title text not null default '다크패턴 검사 보고서',
  risk_level text not null default '보통',
  description text not null default '',
  owner text not null default '',
  status text not null default '검토 전',
  files jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.dp_audit_items (
  id text primary key,
  report_id text not null references public.dp_audit_reports(id) on delete cascade,
  sort_index integer not null default 0,
  image_url text not null default '',
  screen_name text not null default '',
  risk_level text not null default '보통',
  fix text not null default '',
  reason text not null default '',
  checklist text not null default '',
  area text not null default '',
  source_file_name text not null default '',
  needs_review boolean not null default false,
  uploaded_at timestamptz not null default now()
);

create index if not exists dp_audit_items_report_id_idx on public.dp_audit_items(report_id);
create index if not exists dp_audit_items_uploaded_at_idx on public.dp_audit_items(uploaded_at desc);
create index if not exists dp_audit_reports_created_at_idx on public.dp_audit_reports(created_at desc);

alter table public.dp_audit_reports enable row level security;
alter table public.dp_audit_items enable row level security;

drop policy if exists "dp audit reports public select" on public.dp_audit_reports;
drop policy if exists "dp audit reports anon insert" on public.dp_audit_reports;
drop policy if exists "dp audit reports anon update" on public.dp_audit_reports;
drop policy if exists "dp audit reports anon delete" on public.dp_audit_reports;
drop policy if exists "dp audit items public select" on public.dp_audit_items;
drop policy if exists "dp audit items anon insert" on public.dp_audit_items;
drop policy if exists "dp audit items anon update" on public.dp_audit_items;
drop policy if exists "dp audit items anon delete" on public.dp_audit_items;

insert into storage.buckets (id, name, public)
values ('dp-audit-files', 'dp-audit-files', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "dp audit files public select" on storage.objects;
drop policy if exists "dp audit files anon insert" on storage.objects;
drop policy if exists "dp audit files anon update" on storage.objects;
drop policy if exists "dp audit files anon delete" on storage.objects;
