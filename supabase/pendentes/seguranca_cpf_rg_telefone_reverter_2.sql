-- REVERSÃO DA FASE 2 de CPF/RG/telefone: devolve o privilégio por coluna a authenticated (estado posterior à fase 2 de salário/Pix).
-- Não toca nas colunas de salário/Pix.
grant select (cpf, rg, rg_issuer, phone, emergency_phone) on public.employees to authenticated;
grant insert (cpf, rg, rg_issuer, phone, emergency_phone) on public.employees to authenticated;
grant update (cpf, rg, rg_issuer, phone, emergency_phone) on public.employees to authenticated;
