-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261002132253 · md5 normalizado 5f8f828839e2fd19d03d2f5c0f240f70 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- Vira competência automaticamente à 00:00 (America/Sao_Paulo) do dia 1, para empresas com automação ligada.
-- Idempotente: só insere se ainda não houver fechamento daquela competência (unique company_id+competence já existe).
create or replace function public.run_monthly_close_rollover()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company record;
  v_prev_competence date := date_trunc('month', ((now() at time zone 'America/Sao_Paulo')::date - interval '1 day'))::date;
  v_exists boolean;
begin
  for v_company in select company_id from public.company_closing_settings where automation_enabled = true loop
    select exists(
      select 1 from public.monthly_closes
      where company_id = v_company.company_id
        and competence = v_prev_competence
        and status in ('FECHADO_AUTOMATICAMENTE', 'FECHADO_COM_PENDENCIA')
    ) into v_exists;

    if not v_exists then
      insert into public.monthly_closes (company_id, competence, status, snapshot, closed_at)
      values (
        v_company.company_id, v_prev_competence, 'FECHADO_AUTOMATICAMENTE',
        jsonb_build_object(
          'closed_by', 'system_cron',
          'total_expenses', (
            select coalesce(sum(amount), 0) from public.expenses
            where company_id = v_company.company_id and date_trunc('month', competence) = v_prev_competence
          )
        ),
        now()
      )
      on conflict (company_id, competence) do nothing;

      perform private.record_audit_event('period.closed', v_company.company_id, 'monthly_close', v_prev_competence::text,
        jsonb_build_object('competence', v_prev_competence));
    end if;
  end loop;
end;
$$;

-- Agenda diária às 00:00 America/Sao_Paulo (03:00 UTC, Brasil sem horário de verão desde 2019)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'monthly-close-rollover') then
    perform cron.unschedule('monthly-close-rollover');
  end if;
end $$;

select cron.schedule('monthly-close-rollover', '0 3 * * *', $$select public.run_monthly_close_rollover();$$);
;
