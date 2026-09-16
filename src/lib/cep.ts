export function formatCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, "$1-$2");
}

export interface CepAddress {
  street: string;
  neighborhood: string;
  cityName: string;
  stateCode: string;
  ibgeCode: string;
}

export async function fetchAddressByCep(cep: string): Promise<CepAddress | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;

  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!response.ok) return null;

  const data = await response.json();
  if (data.erro) return null;

  return {
    street: data.logradouro ?? "",
    neighborhood: data.bairro ?? "",
    cityName: data.localidade ?? "",
    stateCode: data.uf ?? "",
    ibgeCode: data.ibge ?? "",
  };
}
