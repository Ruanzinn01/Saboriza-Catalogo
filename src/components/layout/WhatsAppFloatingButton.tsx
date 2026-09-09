import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MessageCircle, ShoppingBag } from "lucide-react";
import { CONTACT } from "@/config/contact";
import { buildWhatsAppLink } from "@/lib/whatsapp";

export function WhatsAppFloatingButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (location.pathname.startsWith("/admin")) return null;

  const whatsappLink = buildWhatsAppLink(CONTACT.whatsappNumber, "Olá! Quero fazer um pedido no catálogo Saboriza.");

  function goToCatalog() {
    setOpen(false);
    if (location.pathname !== "/") {
      navigate("/");
      return;
    }
    document.getElementById("destaques")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {open && (
        <div className="mb-3 w-72 overflow-hidden rounded-2xl border border-forest-950/10 bg-cream-50 p-2 shadow-2xl">
          <p className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-wide text-ink-700/50">
            Como você prefere pedir?
          </p>
          <button
            onClick={goToCatalog}
            className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-forest-950/5"
          >
            <ShoppingBag size={18} className="mt-0.5 shrink-0 text-forest-700" />
            <span className="flex flex-col">
              <span className="text-sm font-bold text-ink-900">Escolher produtos no catálogo</span>
              <span className="text-xs text-ink-700/60">Monte o pedido e finalize por aqui</span>
            </span>
          </button>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-forest-950/5"
          >
            <MessageCircle size={18} className="mt-0.5 shrink-0 text-forest-700" />
            <span className="flex flex-col">
              <span className="text-sm font-bold text-ink-900">Falar no WhatsApp</span>
              <span className="text-xs text-ink-700/60">Atendimento direto com um vendedor</span>
            </span>
          </a>
        </div>
      )}

      <button
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Opções de pedido"
        className="flex items-center gap-2 rounded-full bg-linear-to-b from-forest-500 to-forest-700 px-5 py-3 text-sm font-bold text-cream-50 shadow-2xl shadow-forest-950/40 transition-all hover:from-forest-500 hover:to-forest-600 active:scale-[0.97]"
      >
        <MessageCircle size={18} /> Pedir pelo WhatsApp
      </button>
    </div>
  );
}
