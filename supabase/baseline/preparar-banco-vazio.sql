-- Preparo para reproduzir a trilha de supabase/migrations em um banco VAZIO (homologação, local, PGlite).
-- Rodar ANTES da primeira migração e NUNCA em produção (lá esses usuários são reais e já existem).
--
-- Motivo: 20260928152708_phase3_wave1_saas_foundation.sql cria memberships para dois user_id fixos de produção
-- (FK para auth.users, on delete restrict). Em banco vazio a migração falha com 23503. A migração NÃO deve ser editada
-- (o hash do manifesto é o do texto aplicado em produção); em vez disso, criamos os dois usuários como placeholders.
--
-- Segurança dos placeholders: sem senha, e-mail em domínio reservado (.invalid, nunca entrega), sem confirmação e banidos
-- (quando a coluna banned_until existe). Ninguém consegue autenticar com eles. Idempotente. Funciona no auth.users real
-- do Supabase e no stub do PGlite (só preenche as colunas que existem).
do $$
declare
  v_ids uuid[] := array['bdf16019-e1cb-4a1f-b920-86cf7e23452d', 'ffafba32-7378-4aa9-8860-66c918b87dca']::uuid[];
  v_id uuid;
  v_i int := 0;
  v_cols text[];
  v_vals text[];
  c record;
begin
  if to_regclass('auth.users') is null then
    raise exception 'auth.users não existe: este preparo é para banco Supabase ou para o stub do replay';
  end if;
  foreach v_id in array v_ids loop
    v_i := v_i + 1;
    v_cols := array['id']; v_vals := array[quote_literal(v_id)];
    for c in
      select column_name from information_schema.columns
      where table_schema = 'auth' and table_name = 'users'
        and column_name in ('instance_id', 'aud', 'role', 'email', 'raw_app_meta_data', 'raw_user_meta_data', 'created_at', 'updated_at', 'banned_until')
    loop
      v_cols := v_cols || quote_ident(c.column_name);
      v_vals := v_vals || case c.column_name
        when 'instance_id' then quote_literal('00000000-0000-0000-0000-000000000000')
        when 'aud' then quote_literal('authenticated')
        when 'role' then quote_literal('authenticated')
        when 'email' then quote_literal('placeholder-trilha-' || v_i || '@invalid')
        when 'raw_app_meta_data' then quote_literal('{"placeholder": true}')
        when 'raw_user_meta_data' then quote_literal('{"placeholder": true}')
        when 'banned_until' then quote_literal('infinity')
        else 'now()'
      end;
    end loop;
    execute format('insert into auth.users (%s) values (%s) on conflict (id) do nothing', array_to_string(v_cols, ', '), array_to_string(v_vals, ', '));
  end loop;
end $$;
