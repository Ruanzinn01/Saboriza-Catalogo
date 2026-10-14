-- Meta de margem passa a ser opcional (PRD de Produtos): sem meta preenchida, mostra-se só a margem real.
-- Valores já cadastrados (40/50) são preservados; novos produtos nascem sem meta.
alter table public.products
  alter column target_margin_pct drop not null,
  alter column target_margin_pct drop default;
