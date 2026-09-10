import { type FormEvent, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { OrderCustomer } from "@/types/order";

interface CustomerFormProps {
  onSubmit: (customer: OrderCustomer) => void;
  submitting?: boolean;
}

const emptyForm: OrderCustomer = {
  name: "",
  company: "",
  phone: "",
  tradeName: "",
  cnpj: "",
  ie: "",
  email: "",
  address: "",
  neighborhood: "",
  cep: "",
  city: "",
  state: "",
};

type RequiredField = "name" | "company" | "phone";

export function CustomerForm({ onSubmit, submitting }: CustomerFormProps) {
  const [form, setForm] = useState<OrderCustomer>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<RequiredField, string>>>({});

  function handleChange<K extends keyof OrderCustomer>(key: K, value: OrderCustomer[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Partial<Record<RequiredField, string>> = {};
    if (!form.name.trim()) nextErrors.name = "Informe seu nome";
    if (!form.company.trim()) nextErrors.company = "Informe o nome da empresa";
    if (!form.phone.trim()) nextErrors.phone = "Informe um telefone";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({
      name: form.name.trim(),
      company: form.company.trim(),
      phone: form.phone.trim(),
      tradeName: form.tradeName.trim(),
      cnpj: form.cnpj.trim(),
      ie: form.ie.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      neighborhood: form.neighborhood.trim(),
      cep: form.cep.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-3xl border border-forest-950/10 bg-white p-5">
      <h2 className="text-lg font-extrabold text-forest-950">Seus dados</h2>

      <Input label="Nome" placeholder="Seu nome completo" value={form.name} onChange={(e) => handleChange("name", e.target.value)} error={errors.name} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Empresa / Razão social"
          placeholder="Ex: Mercado Boa Compra"
          value={form.company}
          onChange={(e) => handleChange("company", e.target.value)}
          error={errors.company}
        />
        <Input
          label="Nome fantasia (opcional)"
          placeholder="Ex: Mercadinho São Jorge"
          value={form.tradeName}
          onChange={(e) => handleChange("tradeName", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="CNPJ (opcional)" placeholder="00.000.000/0000-00" value={form.cnpj} onChange={(e) => handleChange("cnpj", e.target.value)} />
        <Input
          label="Inscrição estadual (opcional)"
          placeholder="000000000"
          value={form.ie}
          onChange={(e) => handleChange("ie", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Telefone"
          placeholder="(00) 00000-0000"
          value={form.phone}
          onChange={(e) => handleChange("phone", e.target.value)}
          error={errors.phone}
        />
        <Input
          label="E-mail (opcional)"
          type="email"
          placeholder="contato@empresa.com.br"
          value={form.email}
          onChange={(e) => handleChange("email", e.target.value)}
        />
      </div>

      <Input
        label="Endereço (opcional)"
        placeholder="Rua, número"
        value={form.address}
        onChange={(e) => handleChange("address", e.target.value)}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Bairro (opcional)" value={form.neighborhood} onChange={(e) => handleChange("neighborhood", e.target.value)} />
        <Input label="CEP (opcional)" placeholder="00000-000" value={form.cep} onChange={(e) => handleChange("cep", e.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Cidade (opcional)" value={form.city} onChange={(e) => handleChange("city", e.target.value)} />
        <Input label="Estado (opcional)" placeholder="UF" maxLength={2} value={form.state} onChange={(e) => handleChange("state", e.target.value.toUpperCase())} />
      </div>

      <Button type="submit" size="lg" disabled={submitting}>
        {submitting ? "Enviando pedido..." : "Confirmar pedido"}
      </Button>
    </form>
  );
}
