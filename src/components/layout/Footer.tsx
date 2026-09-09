import { Instagram, MessageCircle, Package, Store } from "lucide-react";
import { BrandEmblem } from "./BrandEmblem";
import { CONTACT } from "@/config/contact";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { getTodayMessage } from "@/data/weekday-messages";
import type { Category } from "@/types/category";

interface FooterProps {
  categories: Category[];
  onSelectCategory: (categoryId: string) => void;
}

export function Footer({ categories, onSelectCategory }: FooterProps) {
  const whatsappLink = buildWhatsAppLink(CONTACT.whatsappNumber, "Olá! Quero fazer um pedido no catálogo Saboriza.");
  const instagramLink = `https://instagram.com/${CONTACT.instagramHandle}`;

  return (
    <footer className="mt-12 rounded-t-[3rem] bg-linear-to-b from-forest-900 to-forest-950 px-4 pb-8 pt-14 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-4">
            <BrandEmblem size="sm" />
            <p className="max-w-xs text-sm text-cream-100/60">
              Fábrica de temperos para mercados, restaurantes, padarias e pizzarias. Venda por atacado, em packs
              fechados.
            </p>
            <span className="inline-flex w-fit items-center gap-2 rounded-lg bg-cream-50/10 px-3 py-1.5 text-xs font-medium text-cream-100/70">
              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-forest-500" /> ABERTO ·{" "}
              {getTodayMessage()}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="w-fit bg-linear-to-r from-gold-400 to-gold-600 bg-clip-text text-sm font-bold uppercase tracking-wide text-transparent">Categorias</h3>
            <div className="flex flex-col items-start gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => onSelectCategory(category.id)}
                  className="text-sm text-cream-100/60 transition-colors hover:text-cream-50"
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="w-fit bg-linear-to-r from-gold-400 to-gold-600 bg-clip-text text-sm font-bold uppercase tracking-wide text-transparent">Atendimento</h3>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm text-cream-100/60 transition-colors hover:text-cream-50"
            >
              <MessageCircle size={15} /> {CONTACT.whatsappDisplay}
            </a>
            <a
              href={instagramLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm text-cream-100/60 transition-colors hover:text-cream-50"
            >
              <Instagram size={15} /> @{CONTACT.instagramHandle}
            </a>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="w-fit bg-linear-to-r from-gold-400 to-gold-600 bg-clip-text text-sm font-bold uppercase tracking-wide text-transparent">Como comprar</h3>
            <p className="flex items-start gap-2 text-sm text-cream-100/60">
              <Store size={15} className="mt-0.5 shrink-0" /> Venda exclusiva para lojistas e estabelecimentos.
            </p>
            <p className="flex items-start gap-2 text-sm text-cream-100/60">
              <Package size={15} className="mt-0.5 shrink-0" /> Pedido mínimo de 1 pack por produto.
            </p>
            <p className="text-sm text-cream-100/60">Sem cadastro: escolha os produtos e finalize com nome, empresa e telefone.</p>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-cream-50/10 pt-6 text-xs text-cream-100/40 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Saboriza · O gostinho do Brasil</span>
          <span className="font-mono">Catálogo digital por RE Digital</span>
        </div>
      </div>
    </footer>
  );
}
