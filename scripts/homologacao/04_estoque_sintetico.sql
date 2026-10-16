-- SOMENTE HOMOLOGACAO (dfynvpieyvvameftrent), empresa A. Dados sinteticos de Estoque/Inventario pelos caminhos reais (RPCs sob JWT simulado).
-- Executado em partes (resumo); idempotencia parcial: as entradas/contagens nao se repetem se ja existirem.
-- Usuarios: gestor=d6e148cf-6cd7-4591-a864-2851418c9379 (OWNER), separador=7f1138c7-6aa7-4dc9-b74f-ac7456bfa58c (so Separa Confere).

-- 1) Materias-primas com lote e validade: rascunho + confirm_raw_material_entry como gestor (3 lotes: 2026-12-31, 2027-06-30, 2026-10-20).
--    raw_materials.group_kind aceita MATERIAL|PACKAGING|SUPPLY. Saldo e custo medio saem da propria funcao.

-- 2) Entrada de produto: public.create_stock_entry(produto, 50, obs) como gestor.

-- 3) Devolucao por cancelamento: o gatilho trg_order_cancelled_reversal so dispara se old.separation_finished_at nao e nulo.
--    Sequencia usada: insert stock_movements(origin='order', variacao -3) -> update orders set status='CONFIRMED', separation_finished_at=now()
--    -> update orders set status='CANCELLED' -> stock_returns(CANCELLATION, AWAITING) -> confirm_stock_return(id, 2, obs, true) como gestor.
--    Resultado: 2 unidades voltam ao estoque (movimento 'return'), 1 vira perda (stock_loss_records, source RETURN).

-- 4) Inventario: sessao OPEN escopo ALL; separador: inventory_begin_count(item) -> token -> inventory_register_count(command_id, token, qtd, 'BASE', true);
--    gestor: inventory_resolve_divergence(count, 'APPROVE'|'DISMISS', justificativa) e inventory_close_session(sessao).

-- 5) Job estoque-inventory-sync (select private.inventory_sync_all()): prova de efeito
update public.inventory_sessions set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 minute'
 where company_id = '02854143-5225-4362-b5c3-130729a7f707' and status = 'OPEN';
select private.inventory_sync_all();
select status, closed_at is not null as fechado from public.inventory_sessions where company_id = '02854143-5225-4362-b5c3-130729a7f707';

-- 6) Historico do agendador (somente leitura)
select j.jobname, j.schedule, j.active, count(d.*) as execucoes, count(*) filter (where d.status = 'succeeded') as ok,
       count(*) filter (where d.status = 'failed') as falhas, max(d.start_time) as ultima
from cron.job j left join cron.job_run_details d on d.jobid = j.jobid group by 1, 2, 3 order by 1;
