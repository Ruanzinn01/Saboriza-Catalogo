-- STORAGE COM ESCOPO DE EMPRESA. NÃO APLICADA EM PRODUÇÃO: aguarda aprovação específica.
-- Hoje as políticas dos buckets employee-documents, delivery-receipts e delivery-signatures conferem só o nome do bucket:
-- qualquer usuário autenticado de QUALQUER empresa lista e lê os arquivos. Aqui o acesso passa a depender da empresa
-- dona do arquivo, deduzida do primeiro segmento do caminho:
--   employee-documents  -> <employee_id>/...   (EmployeeProfilePage grava assim)
--   delivery-receipts   -> <order_id>/...      (fulfillment-store grava assim)
--   delivery-signatures -> <order_id>/...
-- Efeito conhecido: 1 objeto de assinatura existente em produção tem primeiro segmento que não é um pedido; ele deixa
-- de ser legível pela API (continua acessível ao service_role). Operadores restritos do Entrega Registra continuam
-- podendo gravar/ler comprovantes da própria empresa (são membros); documentos de colaboradores ficam fora do alcance deles.
-- ATENÇÃO: dentro das subconsultas o nome do arquivo precisa ser qualificado (objects.name); `name` sozinho resolveria
-- para employees.name e trancaria todos os usuários fora dos documentos (defeito pego pelo teste).
-- Reversão: seguranca_storage_multiempresa_reverter.sql

drop policy if exists employee_documents_storage_select on storage.objects;
drop policy if exists employee_documents_storage_insert on storage.objects;
drop policy if exists delivery_receipts_admin_select on storage.objects;
drop policy if exists delivery_receipts_admin_insert on storage.objects;
drop policy if exists delivery_signatures_admin_select on storage.objects;
drop policy if exists delivery_signatures_admin_insert on storage.objects;
drop policy if exists delivery_signatures_admin_update on storage.objects;

create policy employee_documents_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'employee-documents' and exists (
    select 1 from public.employees e
    where e.id::text = (storage.foldername(objects.name))[1]
      and (select private.is_active_company_member(e.company_id))
      and not (select private.is_restricted_operator(e.company_id))));
create policy employee_documents_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'employee-documents' and exists (
    select 1 from public.employees e
    where e.id::text = (storage.foldername(objects.name))[1]
      and (select private.is_active_company_member(e.company_id))
      and not (select private.is_restricted_operator(e.company_id))));

create policy delivery_receipts_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'delivery-receipts' and exists (
    select 1 from public.orders o where o.id::text = (storage.foldername(objects.name))[1] and (select private.is_active_company_member(o.company_id))));
create policy delivery_receipts_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'delivery-receipts' and exists (
    select 1 from public.orders o where o.id::text = (storage.foldername(objects.name))[1] and (select private.is_active_company_member(o.company_id))));

create policy delivery_signatures_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'delivery-signatures' and exists (
    select 1 from public.orders o where o.id::text = (storage.foldername(objects.name))[1] and (select private.is_active_company_member(o.company_id))));
create policy delivery_signatures_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'delivery-signatures' and exists (
    select 1 from public.orders o where o.id::text = (storage.foldername(objects.name))[1] and (select private.is_active_company_member(o.company_id))));
create policy delivery_signatures_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'delivery-signatures' and exists (
    select 1 from public.orders o where o.id::text = (storage.foldername(objects.name))[1] and (select private.is_active_company_member(o.company_id))));
