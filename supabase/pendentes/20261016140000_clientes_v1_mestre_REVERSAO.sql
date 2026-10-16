-- REVERSÃO de 20261016140000_clientes_v1_mestre.sql.
-- ATENÇÃO (destrutiva): apaga as colunas novas de customers, contatos adicionais, metadados de fotos e o registro de
-- comandos. Arquivos já enviados ao bucket customer-media NÃO são apagados por este script (exportar antes se preciso).
-- Só rodar com ordem direta e depois de copiar os dados novos.

drop function if exists public.oris360_customer_capabilities(uuid);
drop function if exists public.oris360_customer_commercial_summary(uuid, text, integer, integer);
drop function if exists private.customer_sales(uuid);
drop function if exists public.oris360_customer_receivables(uuid, integer);
drop function if exists public.oris360_customers_list(uuid, text, text, text, text, uuid, uuid, text, text, text, text, integer, integer);
drop function if exists public.oris360_customer_set_status(uuid, uuid, text, text, integer);
drop function if exists public.oris360_customer_save(uuid, uuid, uuid, integer, jsonb);
drop function if exists public.oris360_customer_media_set_primary(uuid);
drop function if exists private.customer_command_done(uuid, uuid, text, jsonb, jsonb, text, uuid, jsonb);
drop function if exists private.customer_command_replay(uuid, uuid, text, jsonb);

drop policy if exists customer_media_storage_select on storage.objects;
drop policy if exists customer_media_storage_insert on storage.objects;
drop policy if exists customer_media_storage_delete on storage.objects;

drop table if exists public.customer_commands;
drop table if exists public.customer_media;
drop table if exists public.customer_contacts;
drop function if exists private.customer_child_company();

drop trigger if exists customers_no_delete_with_history on public.customers;
drop trigger if exists customers_guard on public.customers;
drop function if exists private.customers_no_delete_with_history();
drop function if exists private.customers_guard();
drop function if exists private.company_date(uuid, timestamptz);
drop function if exists private.cust_norm(text);

alter table public.customers
  drop constraint if exists customers_person_type_chk,
  drop constraint if exists customers_registration_status_chk,
  drop constraint if exists customers_ibge_code_chk,
  drop constraint if exists customers_coordinates_pair_chk,
  drop constraint if exists customers_coordinates_range_chk,
  drop constraint if exists customers_location_confirmed_chk,
  drop constraint if exists customers_proposed_limit_chk,
  drop constraint if exists customers_credit_state_chk;
drop index if exists public.customers_company_display_number_uidx;
drop index if exists public.customers_company_status_idx;
drop index if exists public.customers_seller_idx;
drop index if exists public.customers_promoter_idx;
alter table public.customers
  drop column if exists display_number, drop column if exists person_type, drop column if exists registration_status,
  drop column if exists inactivated_at, drop column if exists inactivated_by, drop column if exists inactivation_reason,
  drop column if exists revision, drop column if exists ie_exempt, drop column if exists tax_profile,
  drop column if exists contact_role, drop column if exists whatsapp_enabled, drop column if exists address_number,
  drop column if exists address_complement, drop column if exists delivery_reference, drop column if exists ibge_code,
  drop column if exists latitude, drop column if exists longitude, drop column if exists location_source,
  drop column if exists location_accuracy_m, drop column if exists location_captured_at,
  drop column if exists location_confirmed_at, drop column if exists location_confirmed_by,
  drop column if exists segment, drop column if exists origin, drop column if exists seller_employee_id,
  drop column if exists promoter_employee_id, drop column if exists service_notes, drop column if exists proposed_credit_limit,
  drop column if exists preferred_payment_days, drop column if exists preferred_payment_method,
  drop column if exists credit_analysis_state, drop column if exists credit_notes;
-- o bucket customer-media é mantido de propósito (apagar bucket com arquivos exige limpeza prévia manual)
