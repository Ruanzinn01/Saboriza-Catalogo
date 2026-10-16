-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261002140551 · md5 normalizado 6cc6a09ece952270901bef897bc7ec4b · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- Central de PDFs/Relatórios: registro persistente de relatórios gerados (PRD Despesas §9 / Financeiro Geral §16).
-- Guarda metadados suficientes para a futura Central montar pacotes mensais sem reexecutar telas.
create table public.generated_report (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  unit_id uuid references public.units(id),
  module text not null,
  report_type text not null,
  period_from date,
  period_to date,
  filters_json jsonb not null default '{}'::jsonb,
  generated_by uuid not null default auth.uid(),
  generated_at timestamptz not null default now(),
  storage_ref text,
  checksum text
);

create index generated_report_company_idx on public.generated_report(company_id, module, generated_at desc);

alter table public.generated_report enable row level security;

create policy generated_report_select on public.generated_report
  for select using (private.has_permission(company_id, 'despesas.read') or private.has_permission(company_id, 'financeiro_geral.read'));

create policy generated_report_insert on public.generated_report
  for insert with check (private.has_permission(company_id, 'despesas.read') or private.has_permission(company_id, 'financeiro_geral.read'));

-- Append-only: sem update/delete — histórico de relatórios não é editado
;
