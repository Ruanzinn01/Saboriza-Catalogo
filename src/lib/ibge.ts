import { supabase } from "@/lib/supabase";

export interface IbgeState {
  code: string;
  name: string;
}

export interface IbgeCity {
  code: string;
  name: string;
  stateCode: string;
  stateName: string;
}

export async function listIbgeStates(): Promise<IbgeState[]> {
  const { data, error } = await supabase
    .from("ibge_cities")
    .select("state_code, state_name")
    .order("state_name")
    .limit(6000);
  if (error || !data) return [];

  const seen = new Set<string>();
  const states: IbgeState[] = [];
  for (const row of data) {
    if (seen.has(row.state_code)) continue;
    seen.add(row.state_code);
    states.push({ code: row.state_code, name: row.state_name });
  }
  return states;
}

export async function listIbgeCitiesByState(stateCode: string, search = ""): Promise<IbgeCity[]> {
  if (!stateCode) return [];

  let query = supabase
    .from("ibge_cities")
    .select("city_code, city_name, state_code, state_name")
    .eq("state_code", stateCode)
    .order("city_name")
    .limit(50);

  if (search.trim()) {
    query = query.ilike("city_name", `%${search.trim()}%`);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => ({
    code: row.city_code,
    name: row.city_name,
    stateCode: row.state_code,
    stateName: row.state_name,
  }));
}

export async function findIbgeCityByCode(cityCode: string): Promise<IbgeCity | null> {
  if (!cityCode) return null;

  const { data, error } = await supabase
    .from("ibge_cities")
    .select("city_code, city_name, state_code, state_name")
    .eq("city_code", cityCode)
    .maybeSingle();

  if (error || !data) return null;

  return { code: data.city_code, name: data.city_name, stateCode: data.state_code, stateName: data.state_name };
}
