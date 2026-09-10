import { type FormEvent, useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AdminState } from "@/components/admin/AdminState";
import { useSettingsStore } from "@/store/settings-store";
import type { Settings } from "@/types/settings";

export function SettingsPage() {
  const settings = useSettingsStore((state) => state.settings);
  const status = useSettingsStore((state) => state.status);
  const fetchSettings = useSettingsStore((state) => state.fetchSettings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);

  const [form, setForm] = useState<Settings | null>(null);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  function handleChange<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    updateSettings(form);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold text-forest-950">Configurações</h1>
      {status === "loading" && !form ? (
        <AdminState variant="loading" message="Carregando configurações..." />
      ) : status === "error" ? (
        <AdminState variant="error" message="Não foi possível carregar as configurações. Tente recarregar a página." />
      ) : form ? (
        <form onSubmit={handleSubmit} className="max-w-lg rounded-3xl border border-forest-950/10 bg-white p-6">
          <p className="mb-4 text-sm text-ink-700/60">
            Dados institucionais usados no painel administrativo e na comanda em PDF.
          </p>
          <div className="flex flex-col gap-4">
            <Input
              label="Nome da fábrica"
              value={form.factoryName}
              onChange={(e) => handleChange("factoryName", e.target.value)}
            />
            <Input
              label="Razão social"
              value={form.legalName}
              onChange={(e) => handleChange("legalName", e.target.value)}
              placeholder="Ex: Saboriza Indústria de Temperos LTDA"
            />
            <Input label="CNPJ" value={form.cnpj} onChange={(e) => handleChange("cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
            <Input
              label="WhatsApp para pedidos"
              value={form.whatsappDisplay}
              onChange={(e) => handleChange("whatsappDisplay", e.target.value)}
              placeholder="(00) 00000-0000"
            />
            <Input
              label="Horário de atendimento"
              value={form.businessHours}
              onChange={(e) => handleChange("businessHours", e.target.value)}
              placeholder="Segunda a sexta, 8h às 18h"
            />
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      ) : (
        <AdminState variant="empty" message="Nenhuma configuração encontrada." />
      )}
    </div>
  );
}
