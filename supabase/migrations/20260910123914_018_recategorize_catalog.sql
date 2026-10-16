-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260910123914 · md5 normalizado 61e1fed0c6d3e7902c638187b48a9afe · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
-- Renomeia/reordena categorias que permanecem
update public.categories set name = 'Sal e Churrasco', sort_order = 0 where slug = 'sal-churrasco';
update public.categories set sort_order = 3 where slug = 'molhos';
update public.categories set sort_order = 5 where slug = 'linha-maior';

-- Cria as 3 categorias novas
insert into public.categories (name, slug, tagline, sort_order, is_active) values
  ('Frascos', 'frascos', '', 1, true),
  ('Potes', 'potes', '', 2, true),
  ('Sachês', 'saches', '', 4, true);

-- Migra os 19 produtos pras categorias novas
update public.products set category_id = (select id from public.categories where slug = 'frascos')
  where name in ('Açafrão', 'Cominho em Pó');

update public.products set category_id = (select id from public.categories where slug = 'potes')
  where name in ('Manjericão Desidratado', 'Orégano', 'Alho Granulado', 'Tempero Completo Natural', 'Páprica Defumada');

update public.products set category_id = (select id from public.categories where slug = 'saches')
  where name in ('Tempero Alho');

update public.products set category_id = (select id from public.categories where slug = 'molhos')
  where name in ('Molho Barbecue', 'Molho de Pimenta Artesanal');

update public.products set category_id = (select id from public.categories where slug = 'sal-churrasco')
  where name in ('Sal Grosso Temperado', 'Sal para Churrasco Premium', 'Tempero Churrasco', 'Combo Churrasco Completo');

update public.products set category_id = (select id from public.categories where slug = 'linha-maior')
  where name in ('Caldo em Pó Profissional', 'Tempero para Food Service', 'Combo Tempero da Casa', 'Colorau', 'Louro em Folhas');

-- Desativa as categorias antigas (agora sem nenhum produto vinculado)
update public.categories set is_active = false
  where slug in ('combos', 'temperos', 'ervas', 'naturais', 'food-service');
;
