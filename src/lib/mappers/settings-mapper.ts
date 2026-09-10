import type { Settings } from "@/types/settings";
import type { Database } from "@/types/supabase";

type SettingsRow = Database["public"]["Tables"]["settings"]["Row"];

export function settingsFromRow(row: SettingsRow): Settings {
  return {
    id: row.id,
    factoryName: row.factory_name,
    whatsappNumber: row.whatsapp_number,
    whatsappDisplay: row.whatsapp_display,
    businessHours: row.business_hours,
    legalName: row.legal_name,
    cnpj: row.cnpj,
    ie: row.ie,
    heroImageUrl: row.hero_image_url,
  };
}

export function settingsToRow(settings: Settings) {
  return {
    factory_name: settings.factoryName,
    whatsapp_number: settings.whatsappNumber,
    whatsapp_display: settings.whatsappDisplay,
    business_hours: settings.businessHours,
    legal_name: settings.legalName,
    cnpj: settings.cnpj,
    ie: settings.ie,
    hero_image_url: settings.heroImageUrl,
  };
}
