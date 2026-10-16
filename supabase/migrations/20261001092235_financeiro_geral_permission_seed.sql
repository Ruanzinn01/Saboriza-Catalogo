-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261001092235 · md5 normalizado f8b55c8d19852a781c1230fc4a66de0a · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

insert into public.permissions (key, name, description, sensitivity)
values ('financeiro_geral.read', 'Ver Financeiro Geral', 'Visualizar o consolidador financeiro geral (entradas, saidas, a receber, a pagar)', 'SENSITIVE')
on conflict (key) do nothing;

insert into public.role_permissions (company_id, role_id, permission_key)
select company_id, role_id, 'financeiro_geral.read'
from public.role_permissions
where permission_key = 'painel_proprietario.read'
on conflict do nothing;
;
