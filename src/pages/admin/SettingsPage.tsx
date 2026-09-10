import { type FormEvent, useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AdminState } from "@/components/admin/AdminState";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { CouponsSection } from "@/components/admin/CouponsSection";
import { cn } from "@/lib/cn";
import { useSettingsStore } from "@/store/settings-store";
import type { Settings } from "@/types/settings";

type SettingsTab = "fabrica" | "aparencia" | "cupons";

const TABS: { value: SettingsTab; label: string }[] = [
  { value: "fabrica", label: "Dados da fábrica" },
  { value: "aparencia", label: "Aparência" },
  { value: "cupons", label: "Cupons" },
];

export function SettingsPage() {
  const settings = useSettingsStore((state) => state.settings);
  const status = useSettingsStore((state) => state.status);
  const fetchSettings = useSettingsStore((state) => state.fetchSettings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);

  const [form, setForm] = useState<Settings | null>(null);
  const [tab, setTab] = useState<SettingsTab>("fabrica");

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

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.value}
            onClick={() => setTab(item.value)}
            className={cn(
              "min-h-11 rounded-full px-4 py-2 text-sm font-bold transition-colors",
              tab === item.value ? "bg-forest-950 text-cream-50" : "bg-forest-950/5 text-ink-700/70 hover:bg-forest-950/10"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {status === "loading" && !form ? (
        <AdminState variant="loading" message="Carregando configurações..." />
      ) : status === "error" ? (
        <AdminState variant="error" message="Não foi possível carregar as configurações. Tente recarregar a página." />
      ) : !form ? (
        <AdminState variant="empty" message="Nenhuma configuração encontrada." />
      ) : (
        <>
          {(tab === "fabrica" || tab === "aparencia") && (
            <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-6">
              {tab === "fabrica" && (
                <div className="rounded-3xl border border-forest-950/10 bg-white p-6">
                  <p className="mb-1 text-lg font-extrabold text-forest-950">Dados da fábrica</p>
                  <p className="mb-4 text-sm text-ink-700/60">Usados no painel administrativo e na comanda em PDF.</p>
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
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Input
                        label="CNPJ"
                        value={form.cnpj}
                        onChange={(e) => handleChange("cnpj", e.target.value)}
                        placeholder="00.000.000/0000-00"
                      />
                      <Input
                        label="Inscrição Estadual"
                        value={form.ie}
                        onChange={(e) => handleChange("ie", e.target.value)}
                        placeholder="000000000"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                </div>
              )}

              {tab === "aparencia" && (
                <div className="rounded-3xl border border-forest-950/10 bg-white p-6">
                  <p className="mb-1 text-lg font-extrabold text-forest-950">Aparência</p>
                  <p className="mb-4 text-sm text-ink-700/60">
                    Imagem da Hero (logomarca/mascote) exibida no topo do catálogo público.
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {form.heroImageUrl ? (
                      <img
                        src={form.heroImageUrl}
                        alt="Imagem da Hero atual"
                        className="h-40 w-full rounded-2xl border border-forest-950/10 bg-cream-50 object-contain"
                      />
                    ) : (
                      <div className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-900/20 bg-cream-50 text-center text-ink-700/50">
                        <ImageOff size={24} />
                        <span className="px-4 text-xs font-semibold">Nenhuma imagem cadastrada — usando a imagem padrão</span>
                      </div>
                    )}
                    <ImageUploader pathPrefix="hero/" onUploaded={(url) => handleChange("heroImageUrl", url)} />
                  </div>
                </div>
              )}

              <div>
                <Button type="submit">Salvar</Button>
              </div>
            </form>
          )}

          {tab === "cupons" && <CouponsSection />}
        </>
      )}
    </div>
  );
}
