-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261004034719 · md5 normalizado 4975a334456958f7e00427f4de5c23fb · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
alter publication supabase_realtime add table
  public.orders,
  public.order_items,
  public.production_records,
  public.stock_movements,
  public.raw_material_entries,
  public.expenses,
  public.expense_launches,
  public.expense_launch_items,
  public.expense_launch_installments,
  public.salary_obligations,
  public.salary_advances,
  public.investment_formation_ledger,
  public.partner_contributions,
  public.receivables,
  public.revenues,
  public.revenue_receipts,
  public.revenue_receivables,
  public.billings,
  public.charges,
  public.fiscal_documents;
