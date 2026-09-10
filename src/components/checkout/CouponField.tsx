import { type FormEvent, useState } from "react";
import { Tag, X } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { normalizeCouponCode } from "@/lib/coupon";
import { couponFromRow } from "@/lib/mappers/coupon-mapper";
import type { Coupon } from "@/types/coupon";

interface CouponFieldProps {
  appliedCoupon: Coupon | null;
  onApply: (coupon: Coupon) => void;
  onRemove: () => void;
}

export function CouponField({ appliedCoupon, onApply, onRemove }: CouponFieldProps) {
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!code.trim()) return;
    setChecking(true);
    setError("");

    const { data, error: queryError } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", normalizeCouponCode(code))
      .eq("is_active", true)
      .maybeSingle();

    setChecking(false);

    if (queryError || !data) {
      setError("Cupom inválido ou inativo.");
      return;
    }

    onApply(couponFromRow(data));
    setCode("");
  }

  if (appliedCoupon) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-forest-700/20 bg-forest-700/5 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-forest-800">
          <Tag size={16} /> Cupom {appliedCoupon.code} aplicado
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remover cupom"
          className="flex h-8 w-8 items-center justify-center rounded-full text-forest-800 hover:bg-forest-700/10"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-ink-900">Possui um cupom?</p>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Ex: NATAL10"
          className="flex-1 uppercase"
        />
        <Button type="submit" variant="outline" disabled={checking || !code.trim()}>
          {checking ? "Verificando..." : "Aplicar"}
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
