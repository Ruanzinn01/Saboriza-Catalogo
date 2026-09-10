import { Input } from "@/components/ui/Input";
import type { CustomerInput } from "@/types/customer";

interface CustomerFormFieldsProps {
  form: CustomerInput;
  errors: Partial<Record<"name" | "companyName" | "phone", string>>;
  onChange: <K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) => void;
}

export function CustomerFormFields({ form, errors, onChange }: CustomerFormFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-700/50">Dados do contato</p>
      <Input label="Nome" value={form.name} onChange={(e) => onChange("name", e.target.value)} error={errors.name} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Telefone" value={form.phone} onChange={(e) => onChange("phone", e.target.value)} error={errors.phone} />
        <Input label="E-mail" type="email" value={form.email} onChange={(e) => onChange("email", e.target.value)} />
      </div>

      <p className="mt-2 text-xs font-bold uppercase tracking-wide text-ink-700/50">Dados da empresa</p>
      <Input
        label="Razão social / empresa"
        value={form.companyName}
        onChange={(e) => onChange("companyName", e.target.value)}
        error={errors.companyName}
      />
      <Input label="Nome fantasia" value={form.tradeName} onChange={(e) => onChange("tradeName", e.target.value)} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="CNPJ" value={form.cnpj} onChange={(e) => onChange("cnpj", e.target.value)} />
        <Input label="Inscrição estadual" value={form.ie} onChange={(e) => onChange("ie", e.target.value)} />
      </div>

      <p className="mt-2 text-xs font-bold uppercase tracking-wide text-ink-700/50">Endereço</p>
      <Input label="Endereço" value={form.address} onChange={(e) => onChange("address", e.target.value)} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Bairro" value={form.neighborhood} onChange={(e) => onChange("neighborhood", e.target.value)} />
        <Input label="CEP" value={form.cep} onChange={(e) => onChange("cep", e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Cidade" value={form.city} onChange={(e) => onChange("city", e.target.value)} />
        <Input
          label="Estado"
          maxLength={2}
          value={form.state}
          onChange={(e) => onChange("state", e.target.value.toUpperCase())}
        />
      </div>
    </div>
  );
}
