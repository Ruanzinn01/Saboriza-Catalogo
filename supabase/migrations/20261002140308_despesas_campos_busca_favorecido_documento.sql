-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261002140308 · md5 normalizado 625d4bf9a90bd205ce2f05c205a828ea · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- Busca geral precisa cobrir favorecido/fornecedor/sócio e documento/NF (PRD Despesas §5.11), não só descrição/categoria.
alter table public.expenses
  add column party_name text,
  add column document_ref text;

create index expenses_party_name_idx on public.expenses using gin (to_tsvector('simple', coalesce(party_name, '')));
comment on column public.expenses.party_name is 'Nome do favorecido/fornecedor/sócio — snapshot para busca e exibição, não é fonte canônica de cadastro';
comment on column public.expenses.document_ref is 'Documento/NF do lançamento';
;
