-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260909232056 · md5 normalizado 095a69aec74cb87a16340e0519d1cb55 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
insert into public.categories (name, slug, tagline, sort_order, is_active) values
  ('Combos',           'combos',           'Kits prontos pra revender.',            0, true),
  ('Temperos',         'temperos',         'Sabor concentrado pro dia a dia.',       1, true),
  ('Ervas',            'ervas',            'Aroma natural em cada folha.',           2, true),
  ('Molhos',           'molhos',           'Mais sabor. Mais vendas.',               3, true),
  ('Sal & Churrasco',  'sal-churrasco',    'Sabor que faz seu produto girar.',       4, true),
  ('Naturais',         'naturais',         'Sem aditivos, direto da origem.',        5, true),
  ('Food Service',     'food-service',     'Volume e praticidade pra cozinha profissional.', 6, true),
  ('Linha Maior',      'linha-maior',      'Mais rendimento. Mais economia.',        7, true);
;
