import { type FormEvent, useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AdminState } from "@/components/admin/AdminState";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { CouponsSection } from "@/components/admin/CouponsSection";
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
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="max-w-lg rounded-3xl border border-forest-950/10 bg-white p-6">
            <p className="mb-1 text-lg font-extrabold text-forest-950">Dados da fábrica</p>
            <p className="mb-4 text-sm text-ink-700/60">Usados no painel administrativo e na comanda em PDF.</p>
            <div className="flex flex-col gap-4">
              <Input label="Nome da fábrica" value={form.factoryName} onChange={(e) => handleChange("factoryName", e.target.value)} />
              <Input
                label="Razão social"
                value={form.legalName}
                onChange={(e) => handleChange("legalName", e.target.value)}
                placeholder="Ex: Saboriza Indústria de Temperos LTDA"
              />
              <div className="grid grid-cols-2 gap-4">
                <Input label="CNPJ" value={form.cnpj} onChange={(e) => handleChange("cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
                <Input label="Inscrição Estadual" value={form.ie} onChange={(e) => handleChange("ie", e.target.value)} placeholder="000000000" />
              </div>
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
            </div>
          </div>

          <div className="max-w-lg rounded-3xl border border-forest-950/10 bg-white p-6">
            <p className="mb-1 text-lg font-extrabold text-forest-950">Aparência</p>
            <p className="mb-4 text-sm text-ink-700/60">Imagem da Hero (logomarca/mascote) exibida no topo do catálogo público.</p>
            <div className="flex flex-col gap-3">
              {form.heroImageUrl ? (
                <img
                  src={form.heroImageUrl}
                  alt="Imagem da Hero atual"
                  className="h-40 w-full rounded-2xl border border-forest-950/10 object-contain bg-cream-50"
                />
              ) : (
                <div className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-900/20 bg-cream-50 text-ink-700/50">
                  <ImageOff size={24} />
                  <span className="text-xs font-semibold">Nenhuma imagem cadastrada — usando a imagem padrão</span>
                </div>
              )}
              <ImageUploader pathPrefix="hero/" onUploaded={(url) => handleChange("heroImageUrl", url)} />
            </div>
          </div>

          <div className="max-w-lg">
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      ) : (
        <AdminState variant="empty" message="Nenhuma configuração encontrada." />
      )}

      <CouponsSection />
    </div>
  );
}
