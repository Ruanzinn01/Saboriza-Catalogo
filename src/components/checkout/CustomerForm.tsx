import { type FormEvent, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { OrderCustomer } from "@/types/order";

interface CustomerFormProps {
  onSubmit: (customer: OrderCustomer) => void;
  submitting?: boolean;
}

const emptyForm = {
  name: "",
  company: "",
  phone: "",
};

type RequiredField = keyof typeof emptyForm;

export function CustomerForm({ onSubmit, submitting }: CustomerFormProps) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<RequiredField, string>>>({});

  function handleChange(key: RequiredField, value: string) {
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

    const customer: OrderCustomer = {
      name: form.name.trim(),
      company: form.company.trim(),
      phone: form.phone.trim(),
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
    onSubmit(customer);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-3xl border border-forest-950/10 bg-white p-5">
      <h2 className="text-lg font-extrabold text-forest-950">Seus dados</h2>

      <Input label="Nome" placeholder="Seu nome completo" value={form.name} onChange={(e) => handleChange("name", e.target.value)} error={errors.name} />

      <Input
        label="Nome da empresa"
        placeholder="Ex: Mercado Boa Compra"
        value={form.company}
        onChange={(e) => handleChange("company", e.target.value)}
        error={errors.company}
      />

      <Input
        label="Número (WhatsApp)"
        placeholder="(00) 00000-0000"
        value={form.phone}
        onChange={(e) => handleChange("phone", e.target.value)}
        error={errors.phone}
      />

      <p className="text-xs text-ink-700/50">Empresas já cadastradas são reconhecidas automaticamente pelo nome.</p>

      <Button type="submit" size="lg" disabled={submitting}>
        {submitting ? "Enviando pedido..." : "Confirmar pedido"}
      </Button>
    </form>
  );
}
