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
    fantasyName: row.fantasy_name,
    cnaeCode: row.cnae_code,
    cnaeDescription: row.cnae_description,
    taxRegime: row.tax_regime,
    municipalRegistration: row.municipal_registration,
    cep: row.cep,
    street: row.street,
    number: row.number,
    complement: row.complement,
    neighborhood: row.neighborhood,
    stateCode: row.state_code,
    stateName: row.state_name,
    cityCode: row.city_code,
    cityName: row.city_name,
    ibgeCode: row.ibge_code,
    country: row.country,
    rbt12: row.rbt12,
    effectiveRate: row.effective_rate,
    scheduleAnnex: row.schedule_annex,
    referenceCompetence: row.reference_competence,
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
    fantasy_name: settings.fantasyName,
    cnae_code: settings.cnaeCode,
    cnae_description: settings.cnaeDescription,
    tax_regime: settings.taxRegime,
    municipal_registration: settings.municipalRegistration,
    cep: settings.cep,
    street: settings.street,
    number: settings.number,
    complement: settings.complement,
    neighborhood: settings.neighborhood,
    state_code: settings.stateCode,
    state_name: settings.stateName,
    city_code: settings.cityCode,
    city_name: settings.cityName,
    ibge_code: settings.ibgeCode,
    country: settings.country,
    rbt12: settings.rbt12,
    effective_rate: settings.effectiveRate,
    schedule_annex: settings.scheduleAnnex,
    reference_competence: settings.referenceCompetence,
  };
}
