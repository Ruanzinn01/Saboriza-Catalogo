import { Link } from "react-router-dom";
import { CalendarDays, Camera, MapPin, Pencil, ShoppingBag, UserRound, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/currency";
import type { CustomerListItem, CustomerListResult, ListCategory } from "@/lib/customers-api";
import { CATEGORY_NAME, CATEGORY_RULE, documentKind, formatAge, formatCustomerNumber, formatDocument } from "@/lib/customers-list";

export const CATEGORY_COLOR: Record<Exclude<ListCategory, "all">, string> = {
  active: "#1b6b44",
  recent: "#d4a93a",
  old: "#b4412f",
  prospect: "#9aa392",
};

const CATEGORY_ORDER: Exclude<ListCategory, "all">[] = ["active", "recent", "old", "prospect"];

function categoryChipClass(category: CustomerListItem["category"]) {
  if (category === "old") return "bg-red-50 text-red-700";
  if (category === "recent") return "bg-gold-400/25 text-gold-600";
  if (category === "prospect") return "bg-forest-950/5 text-ink-muted";
  return "bg-forest-700/10 text-forest-800";
}

interface RowProps {
  item: CustomerListItem;
  today: string;
  financeAvailable: boolean;
  listSearch: string;
  onOpen: () => void;
}

export function CustomerListRow({ item, today, financeAvailable, listSearch, onOpen }: RowProps) {
  const fichaState = { listSearch };
  const overdue = item.overdue_balance ?? 0;
  return (
    <article className="flex flex-col gap-3 border-b border-forest-950/10 p-4 last:border-none sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <Link
          to={`/admin/clientes/${item.id}`}
          state={fichaState}
          onClick={onOpen}
          className="min-h-11 min-w-0 flex-1 rounded-lg text-left"
        >
          <h3 className="inline text-[clamp(1.0625rem,2.4vw,1.125rem)] font-extrabold text-forest-800">{item.trade_name || item.legal_name}</h3>
          <span className="text-sm text-ink-muted">
            {" "}— {item.legal_name} — {documentKind(item)} {item.document ? formatDocument(item.document) : "não informado"} — {formatCustomerNumber(item.display_number)}
          </span>
        </Link>
        <div className="flex flex-wrap gap-2">
          <span className={cn("rounded-full px-3 py-1 text-xs font-bold", categoryChipClass(item.category))}>{CATEGORY_NAME[item.category]}</span>
          {item.registration_status === "INATIVO" && <span className="rounded-full bg-forest-950/10 px-3 py-1 text-xs font-bold text-ink-700">Cadastro inativo</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted"><MapPin size={14} aria-hidden /> Localização</span>
          <div className="flex items-center gap-2">
            <strong className="text-sm text-ink-900">{item.city ? `${item.city} / ${item.state}` : "Cidade não informada"}</strong>
            <Link
              to={`/admin/clientes/${item.id}#localizacao`}
              state={fichaState}
              onClick={onOpen}
              aria-label={item.has_location ? "Ver localização no mapa" : "Sem ponto no mapa informado"}
              title={item.has_location ? "Ver localização no mapa" : "Sem ponto no mapa informado"}
              className={cn("flex h-11 w-11 items-center justify-center rounded-full hover:bg-forest-950/5", item.has_location ? "text-forest-700" : "text-ink-muted/50")}
            >
              <MapPin size={18} aria-hidden />
            </Link>
            <Link
              to={`/admin/clientes/${item.id}#fotos`}
              state={fichaState}
              onClick={onOpen}
              aria-label={item.photo_count > 0 ? `Ver ${item.photo_count} foto(s)` : "Sem fotos cadastradas"}
              title={item.photo_count > 0 ? `${item.photo_count} foto(s)` : "Sem fotos cadastradas"}
              className={cn("flex h-11 w-11 items-center justify-center rounded-full hover:bg-forest-950/5", item.photo_count > 0 ? "text-forest-700" : "text-ink-muted/50")}
            >
              <Camera size={18} aria-hidden />
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted"><UserRound size={14} aria-hidden /> Equipe de atendimento</span>
          <strong className="text-sm text-ink-900">{item.seller?.name ?? "Vendedor não definido"}</strong>
          <span className="text-xs text-ink-muted">Promotor: {item.promoter?.name ?? "não definido"}</span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted"><Wallet size={14} aria-hidden /> Financeiro</span>
          {!financeAvailable ? (
            <strong className="text-sm text-ink-muted">Restrito ao seu perfil</strong>
          ) : overdue > 0 ? (
            <>
              <strong className="text-sm text-red-700">{formatCurrency(overdue)} vencidos</strong>
              <span className="text-xs text-ink-muted">Saldo total em aberto: {formatCurrency(item.open_balance ?? 0)}</span>
            </>
          ) : (
            <>
              <strong className="text-sm text-ink-900">Sem títulos vencidos</strong>
              <span className="text-xs text-ink-muted">{(item.open_balance ?? 0) > 0 ? `A vencer: ${formatCurrency(item.open_balance ?? 0)}` : "Sem saldo em aberto"}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-700">
          <span className="flex items-center gap-1.5"><ShoppingBag size={14} aria-hidden /> Compra: <strong>{formatAge(item.last_purchase, today)}</strong></span>
          <span className="flex items-center gap-1.5 text-ink-muted"><CalendarDays size={14} aria-hidden /> Visita: <strong>Indisponível</strong></span>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/admin/clientes/${item.id}/editar`}
            state={fichaState}
            onClick={onOpen}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-forest-900/20 px-4 text-sm font-semibold text-forest-900 hover:bg-forest-900/5"
          >
            <Pencil size={16} aria-hidden /> Alterar
          </Link>
          <Link
            to={`/admin/clientes/${item.id}`}
            state={fichaState}
            onClick={onOpen}
            className="inline-flex h-11 items-center rounded-2xl bg-forest-700/10 px-4 text-sm font-semibold text-forest-800 hover:bg-forest-700/15"
          >
            Ver cliente
          </Link>
        </div>
      </div>
    </article>
  );
}

interface PortfolioProps {
  summary: CustomerListResult["summary"];
  selected: ListCategory;
  onSelect: (category: Exclude<ListCategory, "all">) => void;
  onDetails: () => void;
}

export function CustomerPortfolioPanel({ summary, selected, onSelect, onDetails }: PortfolioProps) {
  const total = summary.total;
  const radius = 78;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;
  const segments = CATEGORY_ORDER.filter((key) => summary[key] > 0).map((key) => {
    const length = (summary[key] / total) * circumference;
    const segment = { key, dash: Math.max(0, length - 3), offset: -accumulated };
    accumulated += length;
    return segment;
  });
  const label = `Carteira: ${total} clientes. ${CATEGORY_ORDER.map((k) => `${CATEGORY_NAME[k]}: ${summary[k]}`).join("; ")}`;
  return (
    <section className="rounded-3xl border border-forest-950/10 bg-white">
      <div className="flex items-center justify-between border-b border-forest-950/10 px-5 py-4">
        <h2 className="text-base font-extrabold text-forest-950">Carteira de clientes</h2>
        <span className="text-xs text-ink-muted">Segue a busca e os filtros</span>
      </div>
      <div className="flex flex-col items-center gap-4 p-5">
        <svg viewBox="0 0 230 230" role="img" aria-label={label} className="h-48 w-48">
          <circle cx="115" cy="112" r={radius} stroke="#eef0e8" strokeWidth="20" fill="none" />
          {segments.map((segment) => (
            <circle
              key={segment.key}
              cx="115"
              cy="112"
              r={radius}
              stroke={CATEGORY_COLOR[segment.key]}
              strokeWidth="20"
              fill="none"
              strokeDasharray={`${segment.dash} ${circumference - segment.dash}`}
              strokeDashoffset={segment.offset}
              transform="rotate(-90 115 112)"
              tabIndex={0}
              role="button"
              aria-label={`${CATEGORY_NAME[segment.key]}: ${summary[segment.key]}`}
              className="cursor-pointer outline-none focus-visible:stroke-[24]"
              onClick={() => onSelect(segment.key)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(segment.key);
                }
              }}
            />
          ))}
          <text x="115" y="110" textAnchor="middle" fill="#0f3a2b" fontSize="36" fontWeight="700">{total}</text>
          <text x="115" y="135" textAnchor="middle" fill="#6b665a" fontSize="12">clientes</text>
        </svg>
        <div className="flex w-full flex-col">
          {CATEGORY_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              title={CATEGORY_RULE[key]}
              aria-pressed={selected === key}
              className={cn("grid min-h-11 grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-xl px-3 text-left text-sm hover:bg-forest-950/5", selected === key && "bg-forest-950/5")}
            >
              <span className="h-3 w-3 rounded-full" style={{ background: CATEGORY_COLOR[key] }} aria-hidden />
              <span className="text-ink-900">{CATEGORY_NAME[key]}</span>
              <strong>{summary[key]}</strong>
              <small className="w-10 text-right text-ink-muted">{total ? Math.round((summary[key] / total) * 100) : 0}%</small>
            </button>
          ))}
        </div>
        <button type="button" onClick={onDetails} className="min-h-11 text-sm font-semibold text-forest-700 hover:underline">Como ler a carteira</button>
      </div>
    </section>
  );
}

export function PortfolioHelp() {
  return (
    <div role="note" className="rounded-2xl bg-cream-100 p-4 text-sm text-ink-700">
      <strong>Como ler a carteira</strong>
      <ul className="mt-1 list-disc pl-5">
        {CATEGORY_ORDER.map((key) => (
          <li key={key}><strong>{CATEGORY_NAME[key]}:</strong> {CATEGORY_RULE[key]}</li>
        ))}
      </ul>
      <p className="mt-2">Cadastro ativo ou inativo é outra informação. O resumo acompanha busca e filtros; ao escolher um segmento, o total do gráfico continua sendo o do conjunto filtrado. Prospecção não entra neste total.</p>
    </div>
  );
}
