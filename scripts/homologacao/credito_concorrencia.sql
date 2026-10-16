-- PROVA DE CONCORRÊNCIA DE CRÉDITO — RODAR SÓ NA HOMOLOGAÇÃO (dfynvpieyvvameftrent), NUNCA EM PRODUÇÃO.
-- Pré-requisitos: migration supabase/pendentes/20261015120000_credito_cliente_fonte_unica.sql já aplicada
-- na homologação (por ordem direta do responsável). Usa só dados sintéticos criados no passo 0 e
-- termina com ROLLBACK incondicional em todas as sessões. Não foi executado ainda.
--
-- Como rodar: abrir DUAS sessões SQL separadas (duas conexões reais, ex.: dois psql ou duas abas do editor
-- que NÃO compartilhem transação). Substituir os marcadores <...> pelos UUIDs sintéticos da homologação.
--   <EMPRESA>  empresa sintética de homologação
--   <USUARIO>  usuário sintético com billing.invoice_order, billing.view_credit_analysis,
--              billing.view_receivables e customer_credit.change_permanent_limit nessa empresa
-- Execução: S1 roda o bloco "SESSÃO 1" até o ponto de espera; S2 roda "SESSÃO 2" enquanto S1 espera
-- (S1 segura o bloqueio por 10 s com pg_sleep). Depois comparar os tempos e o resultado final.

-- ============================================================================================
-- PASSO 0 (qualquer sessão, UMA vez, e depois COMMIT desta preparação sintética)
-- Criar cliente sintético "ZZ-CONCORRENCIA" com limite 1000 e dois pedidos CONFIRMED de 600.
-- Observação: a reserva conservadora faz os dois pedidos se enxergarem; para o teste de disputa
-- usar pedidos criados em NEW e levá-los a CONFIRMED dentro das sessões (cenário A) ou faturar
-- (cenário B). Ajuste os INSERTs às colunas obrigatórias do ambiente.
-- ============================================================================================
-- insert into public.customers (name, company_name, phone, company_id) values ('ZZ-CONCORRENCIA','ZZ-CONCORRENCIA','0000','<EMPRESA>') returning id;  -- => <CLIENTE>
-- select set_config('request.jwt.claims', '{"sub":"<USUARIO>","role":"authenticated"}', false);
-- select public.oris360_set_credit_limit('<CLIENTE>', 1000, 'prova de concorrencia sintetica');
-- insert into public.orders (order_number, customer_name, phone, total_amount, status, customer_id, company_id)
--   values ('#ZZ-C1','x','0000',600,'NEW','<CLIENTE>','<EMPRESA>'),('#ZZ-C2','x','0000',600,'NEW','<CLIENTE>','<EMPRESA>') returning id;  -- => <PED1>, <PED2>

-- ============================================================================================
-- CENÁRIO A — duas reservas simultâneas (gatilho sync_credit_commitment) no mesmo cliente
-- Esperado: S2 BLOQUEIA até S1 terminar (espera ~10 s); depois as duas reservas existem, sem duplicata,
-- e cada pedido enxerga a do outro (exposição = 1200, excesso = 200, OVER_LIMIT).
-- ============================================================================================
-- SESSÃO 1
begin;
select set_config('request.jwt.claims', '{"sub":"<USUARIO>","role":"authenticated"}', true);
set local role authenticated;
select now() as s1_inicio;
update public.orders set status = 'CONFIRMED' where id = '<PED1>';     -- toma pg_advisory_xact_lock do cliente
select pg_sleep(10);                                                    -- segura o bloqueio
select now() as s1_fim;
rollback;                                                               -- ROLLBACK incondicional (zera a reserva da S1)

-- SESSÃO 2 (iniciar 2-3 s depois do início da S1)
begin;
select set_config('request.jwt.claims', '{"sub":"<USUARIO>","role":"authenticated"}', true);
set local role authenticated;
select now() as s2_inicio;
update public.orders set status = 'CONFIRMED' where id = '<PED2>';     -- deve ESPERAR a S1 liberar o lock
select now() as s2_fim;                                                 -- esperado: s2_fim - s2_inicio >= ~7 s
select (public.oris360_credit_overview('<CLIENTE>', '<PED2>', 600)) ->> 'current_exposure' as exposicao;
rollback;                                                               -- ROLLBACK incondicional

-- ============================================================================================
-- CENÁRIO B — dois faturamentos simultâneos disputando o mesmo limite (oris360_billing_confirm)
-- Pré: limite 1000; <PED1> e <PED2> de 600; levar <PED2> a CANCELLED na preparação para que as reservas
-- não bloqueiem uma à outra e a disputa seja só pelo bloqueio por cliente (ou ver CENÁRIO A para reservas).
-- Esperado: a segunda sessão espera a primeira; ao entrar, enxerga a dívida da primeira (600) e é recusada
-- com "credito bloqueado: OVER_LIMIT" (600 + 600 > 1000). Soma de recebíveis abertos do cliente <= 1000.
-- ============================================================================================
-- SESSÃO 1
begin;
select set_config('request.jwt.claims', '{"sub":"<USUARIO>","role":"authenticated"}', true);
set local role authenticated;
select public.oris360_billing_confirm('<PED1>',
  '[{"type":"BOLETO","amount":600,"generates_credit":true,"installments":[{"number":1,"days":30,"due_date":"2026-12-01","amount":600}]}]'::jsonb,
  'SEM_DOCUMENTO_FISCAL', 'zz-conc-b1');
select pg_sleep(10);
-- Para provar o "depois": trocar o ROLLBACK por COMMIT apenas se o responsável autorizar dado sintético
-- persistido na homologação; por padrão, ROLLBACK (a S2 então passa, o que também é resultado válido
-- e deve ser registrado: ela só passa DEPOIS do rollback da S1).
rollback;

-- SESSÃO 2 (2-3 s depois da S1)
begin;
select set_config('request.jwt.claims', '{"sub":"<USUARIO>","role":"authenticated"}', true);
set local role authenticated;
select now() as s2_inicio;
select public.oris360_billing_confirm('<PED2>',
  '[{"type":"BOLETO","amount":600,"generates_credit":true,"installments":[{"number":1,"days":30,"due_date":"2026-12-01","amount":600}]}]'::jsonb,
  'SEM_DOCUMENTO_FISCAL', 'zz-conc-b2');
select now() as s2_fim;   -- esperado: só retorna após a S1 encerrar (espera ~7 s)
rollback;

-- ============================================================================================
-- CENÁRIO C — mesma chave de idempotência em duas sessões
-- Esperado: sessão 2 espera; ao entrar devolve o MESMO id de faturamento (ou, se a S1 deu rollback,
-- cria o seu). Nunca dois billings com a mesma idempotency_key (índice único + lock).
-- Repetir CENÁRIO B com a mesma chave 'zz-conc-c' nas duas sessões e <PED1> nas duas.
-- ============================================================================================

-- ============================================================================================
-- VERIFICAÇÃO FINAL (qualquer sessão; esperado após todos os ROLLBACKs: nada sobrou das sessões)
-- ============================================================================================
-- select count(*) from public.billings where idempotency_key like 'zz-conc-%';            -- esperado 0
-- select count(*) from public.credit_commitments where customer_id = '<CLIENTE>' and status = 'ABERTO'; -- esperado 0
-- Limpeza do cliente/pedidos sintéticos do passo 0: somente com autorização, só na homologação.
