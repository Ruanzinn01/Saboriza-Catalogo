-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260928214654 · md5 normalizado c966bb0604abe39f9942fbb395e8bcf7 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
-- ÓRIS360 — Colaboradores V4 completo (fidelidade ao HTML aprovado ORIS360_Central_Colaboradores_V4_REFERENCIA_VISUAL_RECONCILIADA.html)
-- Expande o núcleo criado na Onda 4 V1 para as 11 seções do protótipo aprovado.

begin;

alter table public.employees
  add column if not exists social_name text,
  add column if not exists rg text,
  add column if not exists rg_issuer text,
  add column if not exists marital_status text,
  add column if not exists nationality text,
  add column if not exists birthplace text,
  add column if not exists notes text,
  add column if not exists cep text,
  add column if not exists street text,
  add column if not exists address_number text,
  add column if not exists complement text,
  add column if not exists neighborhood text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists emergency_name text,
  add column if not exists emergency_relationship text,
  add column if not exists emergency_phone text,
  add column if not exists employment_type text,
  add column if not exists employment_regime text,
  add column if not exists employment_start_date date,
  add column if not exists employment_end_date date,
  add column if not exists employment_notes text,
  add column if not exists manager_id uuid references public.employees(id),
  add column if not exists cost_center text,
  add column if not exists work_location text,
  add column if not exists lotation_effective_date date,
  add column if not exists timesheet_enabled boolean not null default false,
  add column if not exists timesheet_schedule_label text,
  add column if not exists timesheet_weekly_hours text,
  add column if not exists timesheet_break text,
  add column if not exists timesheet_standard_hours text,
  add column if not exists timesheet_overtime_bank text,
  add column if not exists timesheet_overtime_mode text,
  add column if not exists timesheet_from date,
  add column if not exists timesheet_until date,
  add column if not exists salary_base numeric,
  add column if not exists monthly_divisor numeric not null default 220 check (monthly_divisor > 0),
  add column if not exists salary_additions numeric not null default 0,
  add column if not exists salary_benefits text,
  add column if not exists pix_key text,
  add column if not exists salary_effective_date date,
  add column if not exists overtime_minutes_sample integer not null default 0 check (overtime_minutes_sample >= 0),
  add column if not exists advances_sample numeric not null default 0 check (advances_sample >= 0),
  add column if not exists tool_links jsonb not null default '{}'::jsonb,
  add column if not exists meu360_enabled boolean not null default false,
  add column if not exists personal_email text,
  add column if not exists personal_access_state text not null default 'PENDENTE' check (personal_access_state in ('PENDENTE','ATIVO','BLOQUEADO')),
  add column if not exists admin_access_linked boolean not null default false,
  add column if not exists admin_access_status text,
  add column if not exists admin_access_role_label text,
  add column if not exists admin_access_scope text;

alter table public.employees add constraint employees_manager_company_fkey
  foreign key (company_id, manager_id) references public.employees(company_id, id);

create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  doc_type text not null,
  reference text not null,
  issued_at date,
  expires_at date,
  storage_path text not null,
  file_name text,
  shared_meu360 boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (company_id, employee_id) references public.employees(company_id, id)
);
create index if not exists employee_documents_company_idx on public.employee_documents(company_id, employee_id);

alter table public.employee_documents enable row level security;
revoke all on public.employee_documents from anon;
grant select, insert, update, delete on public.employee_documents to authenticated;
create policy employee_documents_select on public.employee_documents for select to authenticated
  using ((select private.is_active_company_member(company_id)));
create policy employee_documents_insert on public.employee_documents for insert to authenticated
  with check ((select private.is_active_company_member(company_id)));
create policy employee_documents_update on public.employee_documents for update to authenticated
  using ((select private.is_active_company_member(company_id)))
  with check ((select private.is_active_company_member(company_id)));
create policy employee_documents_delete on public.employee_documents for delete to authenticated
  using ((select private.is_active_company_member(company_id)));

insert into storage.buckets(id, name, public, file_size_limit)
values ('employee-documents', 'employee-documents', false, 10485760)
on conflict (id) do nothing;

create policy employee_documents_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'employee-documents');
create policy employee_documents_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'employee-documents');

commit;
;
