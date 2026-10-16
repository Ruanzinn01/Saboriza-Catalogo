import { supabase } from "@/lib/supabase";

// As tabelas/RPCs de Fornecedores V1 ainda não estão em src/types/supabase.ts (migration pendente, não aplicada).
// Esta camada isola o acesso sem tipos gerados; ao aplicar a migration e regenerar os tipos, ela pode ser removida.
interface LooseResult {
  data: unknown;
  error: { message: string } | null;
}

interface LooseQuery extends PromiseLike<LooseResult> {
  select: (columns: string) => LooseQuery;
  eq: (column: string, value: string) => LooseQuery;
  order: (column: string, options?: { ascending: boolean }) => LooseQuery;
}

interface LooseClient {
  from: (table: string) => LooseQuery;
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<LooseResult>;
}

const loose = supabase as unknown as LooseClient;

export function selectFrom(table: string, columns: string) {
  return loose.from(table).select(columns);
}

export async function callRpc<T>(fn: string, args?: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await loose.rpc(fn, args);
  if (error) return { data: null, error: error.message };
  return { data: data as T, error: null };
}

export function friendlyRpcError(message: string, fallback: string): string {
  if (message.startsWith("CONFLITO_REVISAO")) return "Outra pessoa alterou este registro. Recarregue a página e tente de novo.";
  if (message.startsWith("CATEGORIA_DUPLICADA")) return "Já existe uma categoria com esse nome.";
  if (message.includes("Sem permissão")) return "Você não tem permissão para esta ação.";
  return fallback;
}
