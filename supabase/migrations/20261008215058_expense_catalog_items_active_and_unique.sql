-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261008215058 · md5 normalizado bffd21e9375c7bc0ba926e37b80891f0 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- dedupe itens duplicados criados por clique duplo antes de travar com constraint unica
with ranked as (
  select id, row_number() over (
    partition by company_id, kind, name
    order by created_at desc
  ) as rn
  from public.expense_catalog_items
)
delete from public.expense_catalog_items
where id in (select id from ranked where rn > 1);

alter table public.expense_catalog_items
  add column if not exists active boolean not null default true;

alter table public.expense_catalog_items
  add constraint expense_catalog_items_company_id_kind_name_key unique (company_id, kind, name);
;
