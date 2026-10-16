import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { type BankDetails, type BankInput, emptyBankInput, fetchBankDetails, verifyBankDetails } from "@/lib/supplier-api";
import { friendlyRpcError } from "@/lib/supplier-rpc";
import { useSupplierPermissionsStore } from "@/store/supplier-permissions-store";
import { SectionCard, SelectField, TextAreaField, TextField } from "@/components/admin/fornecedores/form/FormUi";

const PIX_TYPES = ["CPF/CNPJ", "E-mail", "Telefone", "Aleatória"];

interface Props {
  supplierId: string | null;
  value: BankInput;
  onChange: (value: BankInput) => void;
  onDirty: () => void;
  // Na ficha só consulta e conferência; a edição acontece no formulário do cadastro.
  readOnly?: boolean;
}

// Dado sensível: sem permissão a seção nem aparece. Com banco.read só vê mascarado; editar exige banco.manage e carrega os valores completos.
// Estes valores NUNCA entram no rascunho nem em eventos. Alterar invalida a conferência anterior (feito no servidor).
export function SupplierBankSection({ supplierId, value, onChange, onDirty, readOnly = false }: Props) {
  const permissions = useSupplierPermissionsStore((state) => state.permissions);
  const canRead = permissions["fornecedores.banco.read"];
  const canManage = permissions["fornecedores.banco.manage"] && !readOnly;
  const canVerify = permissions["fornecedores.banco.verify"];
  const [details, setDetails] = useState<BankDetails | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supplierId || !canRead) return;
    let cancelled = false;
    void fetchBankDetails(supplierId, false).then(({ data }) => {
      if (!cancelled) setDetails(data);
    });
    return () => {
      cancelled = true;
    };
  }, [supplierId, canRead]);

  if (!canRead && !canManage) return null;
  const manageAllowed = canManage;

  async function startEditing() {
    if (supplierId && details?.exists) {
      setLoading(true);
      const { data, error } = await fetchBankDetails(supplierId, true);
      setLoading(false);
      if (error || !data) {
        toast.error(friendlyRpcError(error ?? "", "Não foi possível carregar os dados bancários"));
        return;
      }
      onChange({
        beneficiary_name: data.beneficiary_name ?? "",
        beneficiary_document: data.beneficiary_document ?? "",
        bank: data.bank ?? "",
        branch: data.branch ?? "",
        account: data.account ?? "",
        pix_type: data.pix_type ?? "",
        pix_key: data.pix_key ?? "",
        notes: data.notes ?? "",
      });
    } else {
      onChange(emptyBankInput);
    }
    setEditing(true);
  }

  async function handleVerify() {
    if (!supplierId) return;
    const { error } = await verifyBankDetails(supplierId);
    if (error) {
      toast.error(friendlyRpcError(error, "Não foi possível conferir"));
      return;
    }
    toast.success("Dados bancários conferidos");
    const { data } = await fetchBankDetails(supplierId, false);
    setDetails(data);
  }

  const set = (key: keyof BankInput, text: string) => {
    onChange({ ...value, [key]: text });
    onDirty();
  };

  return (
    <SectionCard id="favorecido" title="Favorecido e dados para conferência" hint="Referência protegida. Pagamentos exigem autorização no Financeiro." step="08">
      {!editing ? (
        <div className="flex flex-col gap-3">
          {details?.exists ? (
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-ink-muted">Favorecido</dt>
                <dd className="font-semibold text-ink-900">{details.beneficiary_name || "Não informado"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Documento do favorecido</dt>
                <dd className="font-semibold text-ink-900">{details.beneficiary_document || "Não informado"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Banco / agência / conta</dt>
                <dd className="font-semibold text-ink-900">{[details.bank, details.branch, details.account].filter(Boolean).join(" · ") || "Não informado"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Chave Pix</dt>
                <dd className="font-semibold text-ink-900">{details.pix_key ? `${details.pix_type || "Chave"}: ${details.pix_key}` : "Não informada"}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-ink-muted">{supplierId ? "Nenhum dado bancário cadastrado." : "Os dados bancários são gravados junto com o cadastro."}</p>
          )}
          {details?.exists && (
            <p className="flex items-center gap-2 text-xs font-semibold text-ink-700">
              <ShieldCheck size={14} aria-hidden />
              {details.verification_status === "VERIFICADO" ? "Conferido" : "Pendente de conferência"}. Valores mascarados na tela.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {canManage && (
              <Button type="button" variant="outline" className="min-h-11" disabled={loading} onClick={() => void startEditing()}>
                {details?.exists ? "Editar dados bancários" : "Informar dados bancários"}
              </Button>
            )}
            {canVerify && supplierId && details?.exists && details.verification_status !== "VERIFICADO" && (
              <Button type="button" variant="secondary" className="min-h-11" onClick={() => void handleVerify()}>
                Marcar como conferido
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label="Nome / razão social do favorecido" value={value.beneficiary_name} maxLength={160} onChange={(e) => set("beneficiary_name", e.target.value)} />
          <TextField label="CPF/CNPJ do favorecido" value={value.beneficiary_document} maxLength={18} onChange={(e) => set("beneficiary_document", e.target.value)} />
          <TextField label="Banco" value={value.bank} maxLength={80} onChange={(e) => set("bank", e.target.value)} />
          <TextField label="Agência" value={value.branch} maxLength={15} onChange={(e) => set("branch", e.target.value)} />
          <TextField label="Conta e dígito" value={value.account} maxLength={25} onChange={(e) => set("account", e.target.value)} />
          <SelectField
            label="Tipo de chave Pix"
            value={value.pix_type}
            onChange={(e) => set("pix_type", e.target.value)}
            options={[{ value: "", label: "Não informada" }, ...PIX_TYPES.map((t) => ({ value: t, label: t }))]}
          />
          <TextField label="Chave Pix" value={value.pix_key} maxLength={160} autoComplete="off" onChange={(e) => set("pix_key", e.target.value)} />
          <TextAreaField className="md:col-span-2" label="Observação para conferência do favorecido" value={value.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      )}
      <p className="rounded-xl bg-forest-950/5 p-3 text-xs text-ink-700">
        Dados alterados ficam pendentes de conferência. Salvar o cadastro não valida a conta nem autoriza transferência; titular divergente exige conferência antes de qualquer pagamento.
      </p>
    </SectionCard>
  );
}

export function bankSectionEdited(initial: BankInput, current: BankInput): boolean {
  return (Object.keys(initial) as (keyof BankInput)[]).some((key) => initial[key] !== current[key]);
}
