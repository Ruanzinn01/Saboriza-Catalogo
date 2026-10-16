-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260930184501 · md5 normalizado 6663bb7fd00d901bacfd2e7c3d0446a5 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

create or replace function public.get_owner_panel_summary(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_a_receber numeric;
  v_a_pagar numeric;
  v_resultado_mes numeric;
  v_resultado_month date;
  v_ativos_monitorados int;
  v_estoque_criticos int;
  v_aportes_mes numeric;
begin
  if not private.has_permission(p_company_id, 'painel_proprietario.read') then
    raise exception 'sem permissao para ver o painel do proprietario';
  end if;

  select coalesce(sum(amount), 0) into v_a_receber
  from public.receivables where company_id = p_company_id and status = 'ABERTO';

  select coalesce(sum(amount), 0) into v_a_pagar
  from public.expenses where company_id = p_company_id and status in ('ABERTO', 'AGENDADO', 'ATRASADO');

  select d.managerial_operating_result, d.month into v_resultado_mes, v_resultado_month
  from public.get_dre_monthly(p_company_id) d
  order by d.month desc
  limit 1;

  select count(*) into v_ativos_monitorados
  from public.asset_units where company_id = p_company_id and status = 'ATIVO';

  select count(*) into v_estoque_criticos
  from public.products where company_id = p_company_id and is_active and current_stock <= min_stock;

  select coalesce(sum(amount), 0) into v_aportes_mes
  from public.partner_contributions
  where company_id = p_company_id and date_trunc('month', created_at) = date_trunc('month', now());

  return jsonb_build_object(
    'saldo_disponivel', jsonb_build_object('disponivel', false, 'motivo', 'sem motor de caixa ainda'),
    'projecao_caixa', jsonb_build_object('disponivel', false, 'motivo', 'sem motor de projecao de caixa ainda'),
    'a_receber', v_a_receber,
    'a_pagar', v_a_pagar,
    'resultado_mes', jsonb_build_object('disponivel', v_resultado_mes is not null, 'valor', v_resultado_mes, 'mes', v_resultado_month),
    'ativos_monitorados', v_ativos_monitorados,
    'estoque_criticos', v_estoque_criticos,
    'aportes_mes', v_aportes_mes,
    'gerado_em', now()
  );
end;
$function$;

create or replace function public.get_pulso_today(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_vendas_hoje numeric;
  v_pedidos_hoje int;
  v_producao_hoje int;
  v_entregas_hoje int;
  v_colaboradores_ativos int;
  v_eventos jsonb;
begin
  if not private.has_permission(p_company_id, 'pulso.read') then
    raise exception 'sem permissao para ver o pulso';
  end if;

  select coalesce(sum(total_amount), 0), count(*) into v_vendas_hoje, v_pedidos_hoje
  from public.orders
  where company_id = p_company_id and created_at >= date_trunc('day', now()) and status <> 'CANCELLED';

  select coalesce(sum(units_quantity), 0) into v_producao_hoje
  from public.production_records
  where company_id = p_company_id and confirmed_at >= date_trunc('day', now()) and status <> 'REVERTIDA';

  select count(*) into v_entregas_hoje
  from public.order_deliveries
  where company_id = p_company_id and delivered_at >= date_trunc('day', now());

  select count(distinct employee_id) into v_colaboradores_ativos
  from public.time_punches
  where company_id = p_company_id and server_time >= date_trunc('day', now());

  select coalesce(jsonb_agg(evt order by evt->>'occurredAt' desc), '[]'::jsonb) into v_eventos
  from (
    (select jsonb_build_object(
      'occurredAt', o.created_at, 'eventType', 'pedido', 'subject', 'Pedido ' || o.order_number,
      'deepLink', '/admin/pedidos/' || o.id
    ) as evt
    from public.orders o
    where o.company_id = p_company_id and o.created_at >= date_trunc('day', now())
    order by o.created_at desc limit 10)
    union all
    (select jsonb_build_object(
      'occurredAt', pr.confirmed_at, 'eventType', 'producao', 'subject', pr.units_quantity || ' unidades produzidas',
      'deepLink', '/admin/producao'
    ) as evt
    from public.production_records pr
    where pr.company_id = p_company_id and pr.confirmed_at >= date_trunc('day', now())
    order by pr.confirmed_at desc limit 10)
  ) events(evt);

  return jsonb_build_object(
    'vendas_hoje', v_vendas_hoje,
    'pedidos_hoje', v_pedidos_hoje,
    'producao_hoje', v_producao_hoje,
    'entregas_hoje', v_entregas_hoje,
    'colaboradores_ativos', v_colaboradores_ativos,
    'eventos', v_eventos,
    'gerado_em', now()
  );
end;
$function$;

insert into public.permissions (key, name, description, sensitivity)
values
  ('painel_proprietario.read', 'Ver Painel do Proprietário', 'Visualizar o resumo executivo consolidado', 'SENSITIVE'),
  ('pulso.read', 'Ver Pulso', 'Visualizar a operação do dia em tempo real', 'NORMAL')
on conflict (key) do nothing;

insert into public.role_permissions (company_id, role_id, permission_key)
select r.company_id, r.id, p.key
from public.roles r
cross join public.permissions p
where p.key in ('painel_proprietario.read', 'pulso.read')
on conflict do nothing;
;
