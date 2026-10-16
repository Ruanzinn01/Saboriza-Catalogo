-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260930180458 · md5 normalizado 2824c4bcd75318af6e1300c32e6f70f4 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

insert into public.role_permissions (company_id, role_id, permission_key)
select r.company_id, r.id, p.key
from public.roles r
cross join public.permissions p
where p.key in ('vendas.read', 'vendas.manage', 'tarefas.read', 'tarefas.manage')
on conflict do nothing;
;
