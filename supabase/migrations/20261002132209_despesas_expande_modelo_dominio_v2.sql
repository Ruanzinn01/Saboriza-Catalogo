-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261002132209 · md5 normalizado d1194958e07731332d7ca056fd085aff · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- Expande expenses para o modelo do pacote mestre Despesas (origin/pattern/competência vs vencimento vs programação vs liquidação/bloqueio/ajuste)
alter table public.expenses
  add column origin text not null default 'expense',
  add column pattern text not null default 'eventual',
  add column scheduled_payment_at timestamptz,
  add column settled_at timestamptz,
  add column block_type text,
  add column block_reason text,
  add column blocked_at timestamptz,
  add column blocked_by uuid,
  add column partner_id uuid references public.company_partners(id),
  add column source_module text,
  add column source_entity_id uuid,
  add column correlation_id uuid default gen_random_uuid(),
  add column idempotency_key text,
  add column original_expense_id uuid references public.expenses(id),
  add column adjustment_reason text;

alter table public.expenses
  add constraint expenses_origin_check check (origin in ('stock','asset','expense','salary','commission','partner')),
  add constraint expenses_pattern_check check (pattern in ('fixed','variable','eventual')),
  add constraint expenses_block_type_check check (block_type is null or block_type in ('hold','skip_occurrence','end_recurrence'));

create index expenses_origin_idx on public.expenses(company_id, origin);
create index expenses_original_idx on public.expenses(original_expense_id) where original_expense_id is not null;

-- Backfill de origin a partir da classificação existente (nature)
update public.expenses set origin = case nature
  when 'INVESTIMENTO' then 'asset'
  when 'SALARIO' then 'salary'
  else 'expense'
end;

-- settled_at herda paid_at já existente (liquidação confirmada)
update public.expenses set settled_at = paid_at where paid_at is not null;

comment on column public.expenses.origin is 'Família do fato (stock|asset|expense|salary|commission|partner) — contrato DATA_MODEL.json do pacote Despesas';
comment on column public.expenses.pattern is 'Padrão de comportamento: fixed|variable|eventual';
comment on column public.expenses.scheduled_payment_at is 'Programação de pagamento — distinta de due_date (vencimento) e settled_at (liquidação real)';
;
