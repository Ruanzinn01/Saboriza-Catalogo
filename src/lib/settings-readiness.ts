import { isValidCnpj } from "@/lib/cnpj";
import type { Settings } from "@/types/settings";

export interface ReadinessItem {
  label: string;
  ok: boolean;
  anchor: string;
}

export function getSettingsReadiness(settings: Settings): ReadinessItem[] {
  const businessComplete =
    settings.factoryName.trim() !== "" &&
    settings.legalName.trim() !== "" &&
    isValidCnpj(settings.cnpj) &&
    settings.ie.trim() !== "" &&
    settings.fantasyName.trim() !== "" &&
    settings.cnaeCode.trim() !== "" &&
    settings.municipalRegistration.trim() !== "";

  const addressValidated =
    settings.cep.trim() !== "" &&
    settings.street.trim() !== "" &&
    settings.number.trim() !== "" &&
    settings.neighborhood.trim() !== "" &&
    settings.stateCode.trim() !== "" &&
    settings.cityCode.trim() !== "" &&
    settings.ibgeCode.trim() !== "";

  const taxRegimeConfirmed =
    settings.taxRegime.trim() !== "" && settings.scheduleAnnex.trim() !== "" && settings.referenceCompetence.trim() !== "";

  return [
    { label: "Cadastro empresarial", ok: businessComplete, anchor: "#bloco-identificacao" },
    { label: "Endereço e códigos", ok: addressValidated, anchor: "#bloco-endereco" },
    { label: "Regime tributário", ok: taxRegimeConfirmed, anchor: "#bloco-parametros" },
  ];
}
