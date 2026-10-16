-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260909232115 · md5 normalizado 70f5d224032187ab2841235378f8ff37 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
insert into public.products
  (category_id, name, description, image_url, presentation, weight_volume, unit_price, pack_quantity, packaging_type, badge, is_active)
select c.id, v.name, v.description, '', v.presentation, v.weight_volume, v.unit_price, v.pack_quantity, v.packaging_type, v.badge, true
from (values
  ('temperos',        'Açafrão',                          'Açafrão-da-terra moído, ideal para arroz, carnes e ensopados.',                          'Frasco', '80g',   4.90, 12, 'Fardo', 'mais-pedido'),
  ('temperos',        'Páprica Defumada',                 'Páprica com aroma defumado natural, ótima para churrasco e carnes grelhadas.',           'Pote',   '100g',  6.50, 12, 'Fardo', null),
  ('temperos',        'Cominho em Pó',                    'Cominho moído fino, essencial para temperos árabes e mexicanos.',                        'Frasco', '60g',   5.30, 12, 'Fardo', null),
  ('sal-churrasco',   'Tempero Churrasco',                'Blend pronto para churrasco, sal grosso e ervas em uma única mistura.',                  'Sachê',  '500g', 12.90, 12, 'Caixa', 'destaque'),
  ('temperos',        'Tempero Alho',                     'Tempero à base de alho desidratado, sal e especiarias selecionadas.',                    'Sachê',  '500g',  8.00, 12, 'Caixa', null),
  ('temperos',        'Colorau',                          'Colorífico tradicional para dar cor e sabor a arroz, feijão e molhos.',                  'Pacote', '500g',  6.90, 20, 'Fardo', null),
  ('ervas',           'Orégano',                          'Orégano desidratado selecionado, folhas inteiras de alto rendimento.',                    'Pote',   '50g',   5.20, 12, 'Fardo', null),
  ('ervas',           'Louro em Folhas',                  'Folhas de louro desidratadas, ideais para caldos e cozidos.',                            'Pacote', '30g',   3.80, 20, 'Pacote', null),
  ('ervas',           'Manjericão Desidratado',           'Manjericão desidratado com aroma intenso, ideal para molhos e massas.',                  'Pote',   '40g',   5.90, 12, 'Fardo', null),
  ('molhos',          'Molho de Pimenta Artesanal',       'Molho de pimenta artesanal com ardência equilibrada para mesas e food service.',         'Frasco', '150ml', 9.50, 12, 'Caixa', 'novidade'),
  ('molhos',          'Molho Barbecue',                   'Molho barbecue encorpado, com toque levemente adocicado e defumado.',                   'Frasco', '300ml', 11.00, 12, 'Caixa', null),
  ('sal-churrasco',   'Sal Grosso Temperado',              'Sal grosso já temperado com ervas, pronto para carnes na brasa.',                        'Pacote', '1kg',   7.40, 10, 'Fardo', null),
  ('sal-churrasco',   'Sal para Churrasco Premium',        'Sal grosso selecionado, granulometria uniforme para churrascarias.',                     'Pacote', '1kg',   9.90, 10, 'Fardo', 'mais-pedido'),
  ('naturais',        'Tempero Completo Natural',          'Mistura de temperos naturais sem conservantes, para uso diário.',                        'Pote',   '300g', 10.50, 12, 'Caixa', 'destaque'),
  ('naturais',        'Alho Granulado',                    'Alho desidratado e granulado, 100% natural, sem aditivos.',                              'Pote',   '100g',  7.20, 12, 'Fardo', null),
  ('combos',          'Combo Churrasco Completo',          'Kit com sal temperado, tempero churrasco e molho barbecue para revenda.',                'Kit',    '5 itens', 45.00, 6, 'Kit', null),
  ('combos',          'Combo Tempero da Casa',              'Kit com os temperos mais vendidos para começar a linha de mercearia.',                  'Kit',    '4 itens', 32.00, 6, 'Kit', null),
  ('food-service',    'Tempero para Food Service',          'Balde econômico para cozinhas industriais e restaurantes de grande volume.',             'Balde',  '5kg',  68.00, 4, 'Caixa', null),
  ('linha-maior',     'Caldo em Pó Profissional',           'Caldo em pó concentrado para uso profissional em grandes preparações.',                  'Pacote', '1kg',  22.00, 10, 'Caixa', null)
) as v(category_slug, name, description, presentation, weight_volume, unit_price, pack_quantity, packaging_type, badge)
join public.categories c on c.slug = v.category_slug;
;
