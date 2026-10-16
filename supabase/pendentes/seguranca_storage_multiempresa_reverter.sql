-- REVERSÃO: volta às políticas que conferem só o nome do bucket (estado atual de produção).
drop policy if exists employee_documents_storage_select on storage.objects;
drop policy if exists employee_documents_storage_insert on storage.objects;
drop policy if exists delivery_receipts_admin_select on storage.objects;
drop policy if exists delivery_receipts_admin_insert on storage.objects;
drop policy if exists delivery_signatures_admin_select on storage.objects;
drop policy if exists delivery_signatures_admin_insert on storage.objects;
drop policy if exists delivery_signatures_admin_update on storage.objects;

create policy employee_documents_storage_select on storage.objects for select to authenticated using (bucket_id = 'employee-documents');
create policy employee_documents_storage_insert on storage.objects for insert to authenticated with check (bucket_id = 'employee-documents');
create policy delivery_receipts_admin_select on storage.objects for select to authenticated using (bucket_id = 'delivery-receipts');
create policy delivery_receipts_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'delivery-receipts');
create policy delivery_signatures_admin_select on storage.objects for select to authenticated using (bucket_id = 'delivery-signatures');
create policy delivery_signatures_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'delivery-signatures');
create policy delivery_signatures_admin_update on storage.objects for update to authenticated using (bucket_id = 'delivery-signatures');
