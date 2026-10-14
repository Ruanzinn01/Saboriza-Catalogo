-- Achado de auditoria: TRUNCATE concedido a anon/authenticated em todo o schema public
-- (grant padrão do projeto). RLS não protege contra TRUNCATE. supabase-js/PostgREST nunca emite
-- TRUNCATE em uso normal — confirmado por busca no código (nenhuma referência a SQL TRUNCATE).
-- Esta migration revoga SÓ TRUNCATE. SELECT/INSERT/UPDATE/DELETE/EXECUTE, RLS e policies ficam
-- intactos. DELETE é usado de propósito em orders e customers (orders-store.ts, customers-store.ts)
-- e continua concedido.

REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- Tabelas criadas depois desta migration também não devem herdar TRUNCATE por padrão.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM anon, authenticated;
