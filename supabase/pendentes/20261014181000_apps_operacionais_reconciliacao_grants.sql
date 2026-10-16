-- Aplicar IMEDIATAMENTE depois de 20261014180000_apps_operacionais_isolados.sql (mesma transação de deploy).
-- Não redefine nada: a definição de is_restricted_operator é a dessa migration (mesma adotada pelo Separa Confere V3).
-- Corrige DEF-06: funções usadas direto em políticas RLS precisam de EXECUTE para authenticated; sem isso
-- toda leitura das tabelas com política restritiva retorna 42501/403 (reproduzido por HTTP real em homologação).
grant execute on function private.is_restricted_operator(uuid) to authenticated;
grant execute on function private.is_app_scope_allowed(uuid, text, boolean, boolean) to authenticated;
