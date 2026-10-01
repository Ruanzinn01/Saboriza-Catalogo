import { createClient } from "@supabase/supabase-js";

// Cliente sem o generic Database — usado só por features cuja tabela/RPC
// ainda não entrou em src/types/supabase.ts (evita editar esse arquivo
// gerado fora do fluxo normal de regeneração).
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseUntyped = createClient(url, key);
