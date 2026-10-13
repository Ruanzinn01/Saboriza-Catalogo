import { supabase } from "@/lib/supabase";

// As funções e views do módulo de Estoque ainda não estão em src/types/supabase.ts (regenerar o arquivo
// exige reaplicar o ajuste de company_id em order_adjustment_requests), então são chamadas sem tipagem gerada.
export interface UntypedError {
  message: string;
}

export interface UntypedResult {
  data: unknown;
  error: UntypedError | null;
}

export function rpcUntyped(fn: string, args?: Record<string, unknown>): PromiseLike<UntypedResult> {
  return (supabase.rpc as unknown as (fn: string, args?: Record<string, unknown>) => PromiseLike<UntypedResult>)(fn, args);
}

interface UntypedQuery extends PromiseLike<UntypedResult> {
  select: (columns: string) => UntypedQuery;
  order: (column: string, options?: { ascending?: boolean }) => UntypedQuery;
  limit: (count: number) => UntypedQuery;
  eq: (column: string, value: unknown) => UntypedQuery;
  in: (column: string, values: unknown[]) => UntypedQuery;
  gte: (column: string, value: unknown) => UntypedQuery;
  lte: (column: string, value: unknown) => UntypedQuery;
}

export function fromUntyped(table: string): UntypedQuery {
  return (supabase.from as unknown as (table: string) => UntypedQuery)(table);
}
