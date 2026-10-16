-- SOMENTE HOMOLOGACAO (dfynvpieyvvameftrent). Linhas sinteticas das tabelas que o semeador generico nao cobre (CHECKs/regras).
-- Rodar depois de 01_seed_generico.sql e novamente 01 (para tabelas filhas). Idempotente.
do $$
declare c record; v_user uuid; v_unit uuid; v_order uuid; v_item uuid; v_rec uuid; v_sh uuid; v_emp uuid; v_dev uuid; v_punch uuid; v_ord_n text;
begin
  for c in select id from public.companies loop
    select user_id into v_user from public.memberships where company_id = c.id order by created_at limit 1;
    select id into v_unit from public.units where company_id = c.id limit 1;

    if not exists (select 1 from public.inventory_sessions where company_id = c.id) then
      insert into public.inventory_sessions (company_id, unit_id, modality, competence, starts_at, ends_at, opened_by)
      select c.id, v_unit, (select (regexp_match(pg_get_constraintdef(oid), '''([^'']+)''::'))[1] from pg_constraint where conname = 'inventory_sessions_modality_check' limit 1),
             current_date, now(), now() + interval '2 hours', v_user;
    end if;

    if not exists (select 1 from public.stock_policies where company_id = c.id) then
      insert into public.stock_policies (company_id, unit_id, min_days, ideal_days, max_days, justification, created_by)
      values (c.id, v_unit, 3, 7, 15, 'fixture sintetica de homologacao', v_user);
    end if;

    select r.id into v_rec from public.receivables r where r.company_id = c.id limit 1;
    if v_rec is not null and not exists (select 1 from public.receivable_payments where company_id = c.id) then
      insert into public.receivable_payments (company_id, receivable_id, kind, amount, idempotency_key, created_by)
      values (c.id, v_rec, (select (regexp_match(pg_get_constraintdef(oid), '''([^'']+)''::'))[1] from pg_constraint where conname = 'receivable_payments_kind_check' limit 1), 10, 'homolog-fixture-' || c.id, v_user);
    end if;

    select i.id, i.order_id into v_item, v_order from public.order_items i where i.company_id = c.id limit 1;
    if v_item is not null and not exists (select 1 from public.separation_shortages where company_id = c.id) then
      select order_number into v_ord_n from public.orders where id = v_order;
      insert into public.separation_shortages (company_id, order_id, order_item_id, order_number, customer_name, product_name, requested_units, separated_units, missing_units, reason, reported_by, reported_by_name)
      values (c.id, v_order, v_item, coalesce(v_ord_n, '0'), 'cliente sintetico', 'produto sintetico', 2, 1, 1, 'fixture', v_user, 'fixture')
      returning id into v_sh;
      insert into public.separation_shortage_events (shortage_id, company_id, event, actor, actor_name, data) values (v_sh, c.id, 'REPORTED', v_user, 'fixture', '{}');
    end if;

    select e.id into v_emp from public.employees e where e.company_id = c.id limit 1;
    select d.id into v_dev from public.time_devices d where d.company_id = c.id limit 1;
    if v_emp is not null and v_dev is not null and not exists (select 1 from public.time_punches where company_id = c.id) then
      update public.employees set timesheet_enabled = true, timesheet_from = current_date - 30 where id = v_emp;
      begin
        insert into public.time_punches (company_id, unit_id, employee_id, device_id, type, photo_path, idempotency_key, created_by)
        values (c.id, v_unit, v_emp, v_dev, 'ENTRADA', 'homolog/fixture.jpg', 'homolog-punch-' || c.id, 'fixture')
        returning id into v_punch;
        insert into public.time_adjustments (company_id, employee_id, punch_id, adjustment_date, field_changed, after_value, reason, created_by, kind)
        values (c.id, v_emp, v_punch, current_date, 'VOID', 'void', 'fixture', v_user, 'VOID_PUNCH');
      exception when others then
        raise notice 'time_punches %: %', c.id, sqlerrm;
      end;
    end if;
  end loop;
end $$;

-- Grupos (um por empresa, nunca compartilhado entre A e B) e assinaturas
do $$
declare c record; g uuid; pv uuid;
begin
  insert into public.plans (code, name) select 'HOMOLOG', 'Plano sintetico' where not exists (select 1 from public.plans where code = 'HOMOLOG');
  insert into public.plan_versions (plan_id, version) select p.id, 1 from public.plans p where p.code = 'HOMOLOG' and not exists (select 1 from public.plan_versions v where v.plan_id = p.id);
  select v.id into pv from public.plan_versions v join public.plans p on p.id = v.plan_id where p.code = 'HOMOLOG' limit 1;
  for c in select id, slug from public.companies loop
    if not exists (select 1 from public.group_companies where company_id = c.id) then
      insert into public.business_groups (display_name) values ('Grupo sintetico ' || c.slug) returning id into g;
      insert into public.group_companies (group_id, company_id) values (g, c.id);
    end if;
    if not exists (select 1 from public.subscriptions where company_id = c.id) then
      insert into public.subscriptions (company_id, plan_version_id) values (c.id, pv);
    end if;
  end loop;
end $$;
