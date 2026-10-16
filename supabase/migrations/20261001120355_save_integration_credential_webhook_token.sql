-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261001120355 · md5 normalizado eaf8d9a639639e3ef956677bd5a7678b · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

create or replace function public.save_integration_credential(p_provider text, p_environment text, p_api_key text, p_wallet_id text DEFAULT NULL::text, p_fiscal_provider_name text DEFAULT NULL::text)
 returns company_integration_credentials
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_company uuid := private.default_company_id();
  v_existing public.company_integration_credentials;
  v_secret_id uuid;
  v_row public.company_integration_credentials;
  v_webhook_token text;
begin
  if not private.has_permission(v_company, 'financeiro.integracoes.manage') then
    raise exception 'Sem permissao para gerenciar integracoes financeiras';
  end if;

  if p_api_key is null or length(trim(p_api_key)) < 8 then
    raise exception 'Chave de API invalida';
  end if;

  select * into v_existing from public.company_integration_credentials
    where company_id = v_company and provider = p_provider and environment = p_environment
    for update;

  if found then
    perform vault.update_secret(v_existing.vault_secret_id, p_api_key);
    v_webhook_token := coalesce(v_existing.webhook_token, encode(gen_random_bytes(24), 'hex'));
    update public.company_integration_credentials
      set key_last4 = right(p_api_key, 4),
          wallet_id = coalesce(p_wallet_id, wallet_id),
          fiscal_provider_name = coalesce(p_fiscal_provider_name, fiscal_provider_name),
          status = 'CONFIGURADO',
          last_error = null,
          webhook_token = v_webhook_token,
          updated_at = now()
      where id = v_existing.id
      returning * into v_row;
  else
    v_secret_id := vault.create_secret(
      p_api_key,
      'integration_' || v_company || '_' || p_provider || '_' || p_environment,
      'Credencial ' || p_provider || ' (' || p_environment || ') da empresa ' || v_company
    );
    v_webhook_token := encode(gen_random_bytes(24), 'hex');
    insert into public.company_integration_credentials (
      company_id, provider, environment, vault_secret_id, key_last4, wallet_id, fiscal_provider_name, status, webhook_token
    ) values (
      v_company, p_provider, p_environment, v_secret_id, right(p_api_key, 4), p_wallet_id, p_fiscal_provider_name, 'CONFIGURADO', v_webhook_token
    ) returning * into v_row;
  end if;

  return v_row;
end;
$function$;
;
