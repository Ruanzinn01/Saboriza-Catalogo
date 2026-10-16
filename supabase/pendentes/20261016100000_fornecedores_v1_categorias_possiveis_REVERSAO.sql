-- REVERSÃO de 20261016100000_fornecedores_v1_categorias_possiveis.sql.
-- ATENÇÃO DESTRUTIVA: apaga categorias, vínculos, avaliações (possíveis fornecedores), produtos declarados e histórico de contatos.
-- Fornecedores formais (public.suppliers) e tudo que já existia NÃO são tocados. Não aplicar sem backup/ordem direta.
drop function if exists public.convert_candidate_to_supplier(uuid, uuid, jsonb);
drop function if exists public.list_candidate_contacts(uuid);
drop function if exists public.search_supplier_candidates(text, text, uuid, integer, integer);
drop function if exists public.record_candidate_contact(uuid, text, date, date, text);
drop function if exists public.update_supplier_candidate(uuid, integer, jsonb);
drop function if exists public.register_supplier_candidate(uuid, jsonb);
drop function if exists public.set_supplier_categories(uuid, uuid[], uuid[]);
drop function if exists public.ensure_default_supplier_categories();
drop function if exists public.set_supplier_category_active(uuid, boolean);
drop function if exists public.rename_supplier_category(uuid, text);
drop function if exists public.create_supplier_category(text);
drop table if exists public.supplier_candidate_contacts;
drop table if exists public.supplier_candidate_categories;
drop table if exists public.supplier_candidate_products;
drop table if exists public.supplier_candidates;
drop table if exists public.supplier_category_links;
drop table if exists public.supplier_categories;
drop function if exists private.supplier_candidate_search_key(jsonb);
drop function if exists private.supplier_candidate_sync_children(uuid, uuid, jsonb);
drop function if exists private.supplier_category_link_guard();
drop function if exists private.supplier_company_for(text);
drop function if exists private.supplier_normalize_text(text);
