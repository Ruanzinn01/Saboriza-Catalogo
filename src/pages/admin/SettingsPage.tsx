import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold text-forest-950">Configurações</h1>
      <div className="max-w-lg rounded-3xl border border-forest-950/10 bg-white p-6">
        <p className="mb-4 text-sm text-ink-700/60">
          Estrutura inicial para configurações gerais da fábrica. Em breve: dados de contato, WhatsApp e horário de
          atendimento.
        </p>
        <div className="flex flex-col gap-4">
          <Input label="Nome da fábrica" defaultValue="Saboriza" disabled />
          <Input label="WhatsApp para pedidos" placeholder="(00) 00000-0000" disabled />
          <Button disabled>Salvar (em breve)</Button>
        </div>
      </div>
    </div>
  );
}
