import { useState } from "react";
import { Instagram, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BrandEmblem } from "@/components/layout/BrandEmblem";
import { getTodayMessage } from "@/data/weekday-messages";
import { useSettingsStore } from "@/store/settings-store";

export function Hero() {
  const heroImageUrl = useSettingsStore((state) => state.settings?.heroImageUrl);
  const [imageFailed, setImageFailed] = useState(false);
  const showCustomImage = Boolean(heroImageUrl) && !imageFailed;

  function scrollToCatalog() {
    document.getElementById("destaques")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <section className="relative overflow-hidden bg-linear-to-b from-forest-950 via-forest-900 to-forest-950">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.3fr_1fr] lg:py-20">
        <div className="flex flex-col gap-5">
          <span className="inline-flex w-fit items-center gap-2 rounded-lg bg-cream-50/10 px-3 py-1.5 text-xs font-medium text-cream-100/70">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" /> ABERTO · {getTodayMessage()}
          </span>
          <span className="text-xs font-bold uppercase tracking-[0.25em] text-cream-100/50">
            Fábrica de Temperos
          </span>
          <h1 className="text-[clamp(2.4rem,6.5vw,4.25rem)] font-extrabold leading-[1.05] text-cream-50">
            O sabor que conquista e faz{" "}
            <span className="bg-linear-to-br from-gold-400 to-gold-600 bg-clip-text text-transparent">
              sua loja vender mais.
            </span>
          </h1>
          <p className="max-w-md text-base text-cream-100/70">Produtos de qualidade, preço justo e muito sabor.</p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button size="lg" onClick={scrollToCatalog}>
              <ShoppingBag size={18} /> Fazer meu pedido
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled
              className="cursor-not-allowed border-cream-50/20 text-cream-50/40"
            >
              <Instagram size={18} /> Ver nosso Instagram
            </Button>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <div className="relative">
            <div className="absolute -inset-10 rounded-full bg-forest-500/30 blur-3xl" aria-hidden />
            {showCustomImage ? (
              <div className="relative w-full max-w-sm shrink-0 overflow-hidden rounded-[2rem] shadow-2xl">
                <img
                  src={heroImageUrl}
                  alt="Saboriza"
                  className="h-auto w-full object-contain"
                  onError={() => setImageFailed(true)}
                />
              </div>
            ) : (
              <BrandEmblem className="relative" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
