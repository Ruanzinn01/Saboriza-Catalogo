-- ============================================================================================
-- CENTRAL DE AUDITORIA · leitura (Visão Geral, Logs, Detalhe) sobre public.audit_events
--
-- STATUS: VERSIONADA, NÃO APLICADA EM NENHUM BANCO. Fica em supabase/pendentes/ de propósito.
-- Reversão: 20261016121000_central_auditoria_leitura_REVERSAO.sql. Aditiva: só cria funções de leitura.
-- Não altera audit_events (continua append-only), não cria coluna, não grava nada.
-- Permissões existentes: audit.read (listar/agregar) e audit.read_sensitive (ver payload completo).
-- A empresa vem de private.default_company_id(), nunca do navegador. anon sem EXECUTE.
-- Não existem em audit_events: módulo, nível/severidade, hash, motivo, antes/depois estruturados.
-- Esses itens NÃO são inventados aqui (ver DECISOES_PENDENTES, DP-AUD-1).
-- ============================================================================================

create or replace function private.audit_central_company(p_sensitive boolean default false)
returns uuid
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_company uuid := (select private.default_company_id());
begin
  if v_company is null or not (select private.has_permission(v_company, 'audit.read')) then
    raise exception 'Sem permissão para consultar a auditoria';
  end if;
  if p_sensitive and not (select private.has_permission(v_company, 'audit.read_sensitive')) then
    return null;
  end if;
  return v_company;
end;
$$;
revoke all on function private.audit_central_company(boolean) from public, anon, authenticated;

create or replace function public.audit_central_overview(p_from timestamptz default null, p_to timestamptz default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.audit_central_company();
  v_from timestamptz := coalesce(p_from, now() - interval '30 days');
  v_to timestamptz := coalesce(p_to, now());
begin
  if v_to < v_from then
    raise exception 'Período inválido';
  end if;
  return jsonb_build_object(
    'from', v_from,
    'to', v_to,
    'total', (select count(*) from public.audit_events e where e.company_id = v_company and e.occurred_at between v_from and v_to),
    'human_actors', (select count(distinct e.actor_user_id) from public.audit_events e where e.company_id = v_company and e.occurred_at between v_from and v_to and e.actor_type = 'USER' and e.actor_user_id is not null),
    'system_events', (select count(*) from public.audit_events e where e.company_id = v_company and e.occurred_at between v_from and v_to and e.actor_type <> 'USER'),
    'last_event_at', (select max(e.occurred_at) from public.audit_events e where e.company_id = v_company),
    'by_event_type', coalesce((select jsonb_agg(jsonb_build_object('key', t.k, 'count', t.n) order by t.n desc, t.k)
      from (select e.event_type k, count(*) n from public.audit_events e where e.company_id = v_company and e.occurred_at between v_from and v_to group by 1 order by 2 desc, 1 limit 10) t), '[]'::jsonb),
    'by_entity_type', coalesce((select jsonb_agg(jsonb_build_object('key', t.k, 'count', t.n) order by t.n desc, t.k)
      from (select e.entity_type k, count(*) n from public.audit_events e where e.company_id = v_company and e.occurred_at between v_from and v_to group by 1 order by 2 desc, 1 limit 10) t), '[]'::jsonb),
    'by_actor_type', coalesce((select jsonb_agg(jsonb_build_object('key', t.k, 'count', t.n) order by t.n desc, t.k)
      from (select e.actor_type k, count(*) n from public.audit_events e where e.company_id = v_company and e.occurred_at between v_from and v_to group by 1) t), '[]'::jsonb),
    'by_day', coalesce((select jsonb_agg(jsonb_build_object('day', t.d, 'count', t.n) order by t.d)
      from (select (e.occurred_at at time zone 'UTC')::date d, count(*) n from public.audit_events e where e.company_id = v_company and e.occurred_at between v_from and v_to group by 1) t), '[]'::jsonb)
  );
end;
$$;

create or replace function public.audit_central_list(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_search text default null,
  p_event_type text default null,
  p_entity_type text default null,
  p_actor_type text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.audit_central_company();
  v_from timestamptz := coalesce(p_from, now() - interval '30 days');
  v_to timestamptz := coalesce(p_to, now());
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_like text;
  v_total bigint;
  v_rows jsonb;
begin
  if v_to < v_from then
    raise exception 'Período inválido';
  end if;
  if p_actor_type is not null and p_actor_type not in ('USER', 'SYSTEM', 'INTEGRATION', 'SUPPORT') then
    raise exception 'Tipo de ator inválido';
  end if;
  v_like := case when v_search is null then null
    else '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%' end;

  select count(*) into v_total
  from public.audit_events e
  where e.company_id = v_company
    and e.occurred_at between v_from and v_to
    and (p_event_type is null or e.event_type = p_event_type)
    and (p_entity_type is null or e.entity_type = p_entity_type)
    and (p_actor_type is null or e.actor_type = p_actor_type)
    and (v_like is null or e.event_type ilike v_like or e.entity_type ilike v_like or e.entity_id ilike v_like or e.correlation_id::text = v_search);

  select coalesce(jsonb_agg(to_jsonb(t) order by t.occurred_at desc, t.id), '[]'::jsonb) into v_rows
  from (
    select e.id, e.occurred_at, e.event_type, e.entity_type, e.entity_id, e.actor_type, e.actor_user_id,
           e.correlation_id, (e.payload <> '{}'::jsonb) as has_payload
    from public.audit_events e
    where e.company_id = v_company
      and e.occurred_at between v_from and v_to
      and (p_event_type is null or e.event_type = p_event_type)
      and (p_entity_type is null or e.entity_type = p_entity_type)
      and (p_actor_type is null or e.actor_type = p_actor_type)
      and (v_like is null or e.event_type ilike v_like or e.entity_type ilike v_like or e.entity_id ilike v_like or e.correlation_id::text = v_search)
    order by e.occurred_at desc, e.id
    limit v_limit offset v_offset
  ) t;

  return jsonb_build_object('total', v_total, 'limit', v_limit, 'offset', v_offset, 'rows', v_rows);
end;
$$;

create or replace function public.audit_central_detail(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.audit_central_company();
  v_sensitive boolean := private.audit_central_company(true) is not null;
  v_row public.audit_events;
begin
  select * into v_row from public.audit_events e where e.id = p_id and e.company_id = v_company;
  if v_row.id is null then
    raise exception 'Evento não encontrado';
  end if;
  return jsonb_build_object(
    'id', v_row.id,
    'event_type', v_row.event_type,
    'schema_version', v_row.schema_version,
    'occurred_at', v_row.occurred_at,
    'recorded_at', v_row.recorded_at,
    'entity_type', v_row.entity_type,
    'entity_id', v_row.entity_id,
    'actor_type', v_row.actor_type,
    'actor_user_id', v_row.actor_user_id,
    'employee_id', v_row.employee_id,
    'unit_id', v_row.unit_id,
    'correlation_id', v_row.correlation_id,
    'causation_id', v_row.causation_id,
    'idempotency_key', v_row.idempotency_key,
    'related_count', (select count(*) - 1 from public.audit_events r where r.company_id = v_company and r.correlation_id = v_row.correlation_id),
    'payload_redacted', not v_sensitive,
    'payload', case when v_sensitive then v_row.payload else null end
  );
end;
$$;

revoke all on function public.audit_central_overview(timestamptz, timestamptz) from public, anon;
revoke all on function public.audit_central_list(timestamptz, timestamptz, text, text, text, text, integer, integer) from public, anon;
revoke all on function public.audit_central_detail(uuid) from public, anon;
grant execute on function public.audit_central_overview(timestamptz, timestamptz) to authenticated;
grant execute on function public.audit_central_list(timestamptz, timestamptz, text, text, text, text, integer, integer) to authenticated;
grant execute on function public.audit_central_detail(uuid) to authenticated;
