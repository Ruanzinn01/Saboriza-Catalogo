import { type FormEvent, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { OrderCustomer } from "@/types/order";

interface CustomerFormProps {
  onSubmit: (customer: OrderCustomer) => void;
  submitting?: boolean;
}

export function CustomerForm({ onSubmit, submitting }: CustomerFormProps) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Partial<OrderCustomer>>({});

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Partial<OrderCustomer> = {};
    if (!name.trim()) nextErrors.name = "Informe seu nome";
    if (!company.trim()) nextErrors.company = "Informe o nome da empresa";
    if (!phone.trim()) nextErrors.phone = "Informe um telefone";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit({ name: name.trim(), company: company.trim(), phone: phone.trim() });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-3xl border border-forest-950/10 bg-white p-5">
      <h2 className="text-lg font-extrabold text-forest-950">Seus dados</h2>
      <Input label="Nome" placeholder="Seu nome completo" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
      <Input
        label="Nome da empresa"
        placeholder="Ex: Mercado Boa Compra"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        error={errors.company}
      />
      <Input
        label="Telefone"
        placeholder="(00) 00000-0000"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        error={errors.phone}
      />
      <Button type="submit" size="lg" disabled={submitting}>
        {submitting ? "Enviando pedido..." : "Confirmar pedido"}
      </Button>
    </form>
  );
}
