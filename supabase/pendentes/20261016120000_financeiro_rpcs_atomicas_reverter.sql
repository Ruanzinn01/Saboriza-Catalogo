-- Reversão de 20261016120000_financeiro_rpcs_atomicas.sql. Atenção: apagar financial_commands perde o registro de idempotência;
-- os eventos já gravados em audit_events (append-only) permanecem.
drop function if exists public.financeiro_pagar_despesa(uuid, uuid, numeric);
drop function if exists public.financeiro_receber_receita(uuid, uuid, numeric, date);
drop function if exists public.financeiro_estornar_recebimento(uuid, uuid, text);
drop function if exists public.financeiro_registrar_aporte(uuid, uuid, numeric, text, text, date, date, text, uuid);
drop function if exists public.financeiro_estornar_aporte(uuid, uuid, text);
drop function if exists private.fin_command_end(uuid, uuid, text, jsonb, jsonb, text, text, text, jsonb);
drop function if exists private.fin_command_begin(uuid, uuid, text, jsonb);
drop index if exists public.revenue_receipts_one_reversal_per_receipt;
drop index if exists public.partner_contributions_one_reversal_per_contribution;
drop table if exists public.financial_commands;
