import type { EntryStatus, RawMaterialEntry } from "@/types/raw-material";
import type { Database } from "@/types/supabase";

type EntryRow = Database["public"]["Tables"]["raw_material_entries"]["Row"];

export function rawMaterialEntryFromRow(row: EntryRow): RawMaterialEntry {
  return {
    id: row.id,
    rawMaterialId: row.raw_material_id,
    supplierId: row.supplier_id,
    status: row.status as EntryStatus,
    packagesQuantity: row.packages_quantity,
    unitPrice: row.unit_price,
    conversionFactor: row.conversion_factor,
    controlQuantity: row.control_quantity,
    totalValue: row.total_value,
    batch: row.batch,
    expiryDate: row.expiry_date,
    entryDate: row.entry_date,
    invoiceNumber: row.invoice_number,
    invoiceSeries: row.invoice_series,
    invoiceIssueDate: row.invoice_issue_date,
    invoiceAccessKey: row.invoice_access_key,
    responsibleId: row.responsible_id,
    previousBalance: row.previous_balance,
    newBalance: row.new_balance,
    reversalReason: row.reversal_reason,
    reversedAt: row.reversed_at,
    reversedBy: row.reversed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
