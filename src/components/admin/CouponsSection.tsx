import { type FormEvent, useEffect, useState } from "react";
import { Plus, Power, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AdminState } from "@/components/admin/AdminState";
import { RowActionsMenu } from "@/components/admin/RowActionsMenu";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useCouponsStore } from "@/store/coupons-store";
import { normalizeCouponCode } from "@/lib/coupon";
import { formatCurrency } from "@/lib/currency";
import type { Coupon, CouponDiscountType } from "@/types/coupon";

export function CouponsSection() {
  const coupons = useCouponsStore((state) => state.coupons);
  const status = useCouponsStore((state) => state.status);
  const fetchCoupons = useCouponsStore((state) => state.fetchCoupons);
  const addCoupon = useCouponsStore((state) => state.addCoupon);
  const updateCoupon = useCouponsStore((state) => state.updateCoupon);
  const removeCoupon = useCouponsStore((state) => state.removeCoupon);

  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<CouponDiscountType>("percentage");
  const [discountValue, setDiscountValue] = useState(0);
  const [couponToDelete, setCouponToDelete] = useState<Coupon | null>(null);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeCouponCode(code);
    if (!normalized || discountValue <= 0) return;

    addCoupon({
      id: crypto.randomUUID(),
      code: normalized,
      discountType,
      discountValue,
      active: true,
    });
    setCode("");
    setDiscountValue(0);
  }

  function formatDiscount(coupon: Coupon) {
    return coupon.discountType === "percentage" ? `${coupon.discountValue}%` : formatCurrency(coupon.discountValue);
  }

  return (
    <div className="rounded-3xl border border-forest-950/10 bg-white p-6">
      <p className="mb-1 text-lg font-extrabold text-forest-950">Cupons</p>
      <p className="mb-4 text-sm text-ink-700/60">Promoções simples aplicáveis no checkout — percentual ou valor fixo.</p>

      <form onSubmit={handleSubmit} className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-forest-950/10 bg-cream-50 p-4">
        <Input
          label="Código"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Ex: NATAL10"
          className="min-w-[160px] flex-1"
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink-900">Tipo</span>
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as CouponDiscountType)}
            className="h-11 rounded-xl border border-ink-900/15 bg-white px-4 text-sm text-ink-900 outline-none focus:border-forest-700"
          >
            <option value="percentage">Percentual</option>
            <option value="fixed">Valor fixo</option>
          </select>
        </label>
        <Input
          label={discountType === "percentage" ? "Valor (%)" : "Valor (R$)"}
          type="number"
          min="0"
          step="0.01"
          value={discountValue}
          onChange={(e) => setDiscountValue(Number(e.target.value))}
          className="w-32"
        />
        <Button type="submit">
          <Plus size={18} /> Criar cupom
        </Button>
      </form>

      {status === "loading" && coupons.length === 0 ? (
        <AdminState variant="loading" message="Carregando cupons..." />
      ) : status === "error" ? (
        <AdminState variant="error" message="Não foi possível carregar os cupons." />
      ) : coupons.length === 0 ? (
        <AdminState variant="empty" message="Nenhum cupom cadastrado ainda." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-forest-950/10">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-700/50">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Desconto</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id} className="border-b border-forest-950/5 last:border-none">
                  <td className="px-4 py-3 font-semibold text-ink-900">{coupon.code}</td>
                  <td className="px-4 py-3 text-ink-700/70">{formatDiscount(coupon)}</td>
                  <td className="px-4 py-3 text-ink-700/70">{coupon.discountType === "percentage" ? "Percentual" : "Fixo"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        coupon.active
                          ? "rounded-full bg-forest-700/10 px-3 py-1 text-xs font-bold text-forest-800"
                          : "rounded-full bg-ink-900/10 px-3 py-1 text-xs font-bold text-ink-700/60"
                      }
                    >
                      {coupon.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <RowActionsMenu
                        items={[
                          {
                            label: coupon.active ? "Desativar" : "Ativar",
                            icon: <Power size={16} />,
                            onClick: () => updateCoupon(coupon.id, { active: !coupon.active }),
                          },
                          {
                            label: "Excluir",
                            icon: <Trash2 size={16} />,
                            destructive: true,
                            onClick: () => setCouponToDelete(coupon),
                          },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={couponToDelete !== null}
        onClose={() => setCouponToDelete(null)}
        title="Excluir cupom?"
        description={
          <>
            <strong className="text-ink-900">{couponToDelete?.code}</strong> será removido. Pedidos que já usaram esse cupom
            mantêm o desconto registrado — só o cupom em si deixa de existir.
          </>
        }
        confirmLabel="Excluir"
        destructive
        onConfirm={() => {
          if (!couponToDelete) return;
          removeCoupon(couponToDelete.id);
          setCouponToDelete(null);
        }}
      />
    </div>
  );
}
