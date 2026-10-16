-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260930123953 · md5 normalizado 4fe8deed30794054f7ad26be9e354d9d · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
INSERT INTO role_permissions (role_id, company_id, permission_key)
SELECT DISTINCT r.id, r.company_id, 'dre.read'
FROM roles r
JOIN role_permissions rp ON rp.role_id = r.id AND rp.permission_key = 'patrimonio.manage'
ON CONFLICT DO NOTHING;
