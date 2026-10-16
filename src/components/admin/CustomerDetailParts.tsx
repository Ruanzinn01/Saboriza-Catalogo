import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, ChevronDown, Mail, MapPin, Phone, ShoppingBag, CalendarDays, Trophy } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/currency";
import type {
  ApiResult,
  CommercialSummary,
  CustomerFullProfile,
  CustomerMedia,
  PurchasePeriod,
  ReceivablesView,
} from "@/lib/customers-api";
import {
  addressLines,
  buildBars,
  customerMapUrl,
  filterPaid,
  methodLabel,
  onTimePercentLabel,
  openBadge,
  paidBadge,
  rankLabel,
  titleRowLabel,
  type PaymentFilter,
  whatsappUrl,
} from "@/lib/customer-detail";
import { formatAge, formatCustomerNumber, formatDate, formatDocument } from "@/lib/customers-list";
import { CREDIT_STATE_LABEL } from "@/lib/customer-form";

export function Card({ id, title, action, children, className }: { id?: string; title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("scroll-mt-20 rounded-3xl border border-forest-950/10 bg-white", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-forest-950/10 px-5 py-4">
        <h2 className="text-base font-extrabold text-forest-950">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function UnavailableNote({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-forest-950/5 p-4 text-sm text-ink-muted">{children}</p>;
}

function Chip({ children, tone }: { children: ReactNode; tone?: "bad" | "warn" | "neutral" }) {
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-bold",
        tone === "bad" && "bg-red-50 text-red-700",
        tone === "warn" && "bg-gold-400/25 text-gold-600",
        (tone === "neutral" || tone === undefined) && "bg-forest-700/10 text-forest-800"
      )}
    >
      {children}
    </span>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-bold uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="text-sm font-semibold text-ink-900">{value || "-----"}</dd>
    </div>
  );
}

interface HeaderProps {
  profile: CustomerFullProfile;
  onEdit: string;
  newOrderTo: string | null;
  onToggleStatus: () => void;
  statusBusy: boolean;
}

export function CustomerHeaderCard({ profile, onEdit, newOrderTo, onToggleStatus, statusBusy }: HeaderProps) {
  const [expanded, setExpanded] = useState(false);
  const { customer: c } = profile;
  const wa = c.whatsapp_enabled ? whatsappUrl(c.phone) : null;
  const map = customerMapUrl(c);
  const lines = addressLines(c);
  const inactive = c.registration_status === "INATIVO";
  return (
    <section className="rounded-3xl border border-forest-950/10 bg-white">
      <div className="flex flex-col gap-3 px-5 py-5">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">Cliente · {formatCustomerNumber(c.display_number)}</p>
        <h1 className="text-[clamp(1.5rem,4vw,2rem)] font-extrabold leading-tight text-forest-950">{c.trade_name || c.company_name}</h1>
        <p className="text-sm text-ink-muted">{c.company_name}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Link to={onEdit} className="inline-flex h-11 items-center rounded-2xl bg-gradient-to-b from-gold-400 to-gold-600 px-5 text-sm font-semibold text-forest-950">Alterar</Link>
          {newOrderTo ? (
            <Link to={newOrderTo} className="inline-flex h-11 items-center gap-2 rounded-2xl border border-forest-900/20 px-5 text-sm font-semibold text-forest-900 hover:bg-forest-900/5">
              <ShoppingBag size={16} aria-hidden /> Novo pedido
            </Link>
          ) : (
            <span title="Reative o cadastro para criar pedidos" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-forest-900/10 px-5 text-sm font-semibold text-ink-muted">
              <ShoppingBag size={16} aria-hidden /> Novo pedido indisponível
            </span>
          )}
          <button type="button" onClick={onToggleStatus} disabled={statusBusy} className="inline-flex h-11 items-center rounded-2xl px-4 text-sm font-semibold text-ink-700 hover:bg-forest-950/5 disabled:opacity-50">
            {inactive ? "Reativar cadastro" : "Inativar cadastro"}
          </button>
          <Chip tone={inactive ? "warn" : undefined}>{inactive ? "Cadastro inativo" : "Cliente ativo"}</Chip>
        </div>
        {inactive && c.inactivation_reason && <p className="text-xs text-ink-muted">Motivo da inativação: {c.inactivation_reason}</p>}
      </div>

      <div id="localizacao" className="grid scroll-mt-20 grid-cols-1 gap-4 border-t border-forest-950/10 px-5 py-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 text-sm">
          <span className="flex items-center gap-2"><Phone size={16} className="text-forest-700" aria-hidden /> <strong>{c.phone || "Telefone não informado"}</strong></span>
          {wa && <a className="min-h-11 text-forest-700 hover:underline" href={wa} target="_blank" rel="noopener noreferrer">Conversar no WhatsApp ↗</a>}
          <span className="flex items-center gap-2 text-ink-700"><Mail size={16} className="text-forest-700" aria-hidden /> {c.email || "E-mail não informado"}</span>
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <span className="flex items-start gap-2">
            <MapPin size={16} className="mt-0.5 text-forest-700" aria-hidden />
            <span>
              {lines.length ? lines.map((line, i) => <span key={line} className={i === 0 ? "block font-semibold text-ink-900" : "block text-ink-700"}>{line}</span>) : "Endereço não informado"}
            </span>
          </span>
          {map.url ? (
            <a className="flex min-h-11 items-center text-forest-700 hover:underline" href={map.url} target="_blank" rel="noopener noreferrer">
              {map.confirmed ? "Visualizar no mapa ↗" : "Buscar endereço no mapa ↗ (ponto não informado)"}
            </a>
          ) : (
            <span className="text-xs text-ink-muted">Sem endereço ou ponto para abrir no mapa.</span>
          )}
          {c.latitude !== null && (
            <span className="text-xs text-ink-muted">
              Ponto {c.latitude}, {c.longitude} · {c.location_confirmed_at ? "conferido" : "não conferido"}
              {c.location_accuracy_m ? ` · precisão ${Math.round(c.location_accuracy_m)} m` : ""}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-forest-950/10 px-5 py-3 text-sm text-ink-700">
        <span>Vendedor responsável: <strong>{profile.seller?.name ?? "não definido"}</strong></span>
        <span>Promotor: <strong>{profile.promoter?.name ?? "não definido"}</strong></span>
      </div>

      {expanded && (
        <dl className="grid grid-cols-1 gap-4 border-t border-forest-950/10 px-5 py-4 sm:grid-cols-2" id="cadastro-completo">
          <Field label={c.person_type === "PJ" ? "Razão social" : "Nome completo"} value={c.company_name} />
          <Field label={c.person_type === "PJ" ? "CNPJ" : "CPF"} value={c.cnpj ? formatDocument(c.cnpj) : ""} />
          <Field label="Inscrição estadual" value={c.ie_exempt ? "Isento" : c.ie} />
          <Field label="Enquadramento informado" value={c.tax_profile} />
          <Field label="Contato principal" value={[c.name, c.contact_role].filter(Boolean).join(" · ")} />
          <Field label="Segmento" value={c.segment} />
          <Field label="Origem do cadastro" value={c.origin} />
          <Field label="Código IBGE do município" value={c.ibge_code} />
          <Field label="Referência / entrega" value={c.delivery_reference} />
          <Field label="Observações de atendimento" value={c.service_notes} />
          <Field label="Prazo preferencial" value={c.preferred_payment_days === "cash" ? "À vista" : c.preferred_payment_days === "custom" ? "A definir na negociação" : c.preferred_payment_days ? `${c.preferred_payment_days} dias` : ""} />
          <Field label="Forma de pagamento preferencial" value={c.preferred_payment_method} />
          <Field label="Limite proposto (não é o aprovado)" value={formatCurrency(c.proposed_credit_limit)} />
          <Field label="Situação da análise" value={CREDIT_STATE_LABEL[c.credit_analysis_state] ?? c.credit_analysis_state} />
          {profile.contacts.map((contact) => (
            <Field key={contact.id} label={`Contato adicional${contact.role ? ` · ${contact.role}` : ""}`} value={[contact.name, contact.phone, contact.email].filter(Boolean).join(" · ")} />
          ))}
        </dl>
      )}
      <div className="border-t border-forest-950/10">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="cadastro-completo"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-b-3xl text-sm font-semibold text-forest-700 hover:bg-forest-950/5"
        >
          {expanded ? "Recolher cadastro" : "Ver cadastro completo"}
          <ChevronDown size={16} className={cn("transition-transform", expanded && "rotate-180")} aria-hidden />
        </button>
      </div>
    </section>
  );
}

interface RecentProps {
  summary: ApiResult<CommercialSummary> | null;
}

export function RecentActivityCard({ summary }: RecentProps) {
  const ready = summary?.state === "ready" ? summary.data : null;
  const today = ready?.as_of ?? new Date().toISOString().slice(0, 10);
  return (
    <Card title="Atividade recente" action={ready ? <span className="text-xs text-ink-muted">Até {formatDate(ready.as_of)}</span> : null}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-cream-50 p-4">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted"><ShoppingBag size={14} aria-hidden /> Último pedido de compra</span>
          <p className="mt-1 text-lg font-extrabold text-forest-950">{ready ? formatAge(ready.last_order_at, today) : "Carregando..."}</p>
          <span className="text-xs text-ink-muted">{ready?.last_order_at ? formatDate(ready.last_order_at) : "Pedido cancelado não conta"}</span>
          <p className="mt-2 text-xs text-ink-muted">Última compra faturada: <strong>{ready ? formatAge(ready.last_billed_purchase, today) : "..."}</strong></p>
        </div>
        <div className="rounded-2xl bg-cream-50 p-4 sm:col-span-2">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted"><CalendarDays size={14} aria-hidden /> Visitas realizadas</span>
          <p className="mt-1 text-lg font-extrabold text-ink-muted">Indisponível</p>
          <span className="text-xs text-ink-muted">
            Última visita, visitas em 30/60/90 dias e recência de vendedor e promotor dependem do motor de Tarefas/Missões, que ainda não está integrado. Nada é estimado a partir de pedidos ou WhatsApp.
          </span>
        </div>
      </div>
    </Card>
  );
}

export function UnavailableCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card title={title} action={<Chip tone="neutral">Indisponível</Chip>}>
      <UnavailableNote>{children}</UnavailableNote>
    </Card>
  );
}

interface PurchasesProps {
  summary: ApiResult<CommercialSummary> | null;
  period: PurchasePeriod;
  onPeriod: (p: PurchasePeriod) => void;
  ordersOfMonth: (key: string) => { id: string; number: string; date: string; total: number; status: ReactNode }[];
}

const PERIODS: { value: PurchasePeriod; label: string }[] = [
  { value: "month", label: "Mês" },
  { value: "six", label: "6 meses" },
  { value: "year", label: "1 ano" },
];

export function PurchasesCard({ summary, period, onPeriod, ordersOfMonth }: PurchasesProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [rankOpen, setRankOpen] = useState(false);
  const ready = summary?.state === "ready" ? summary.data : null;
  const bars = ready ? buildBars(ready.series) : [];
  const detail = selectedKey ? ordersOfMonth(selectedKey) : [];
  return (
    <Card title="Resumo do cliente">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-ink-muted">Período de compras</span>
        <div role="group" aria-label="Período de compras" className="flex rounded-xl bg-forest-950/5 p-1">
          {PERIODS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={period === option.value}
              onClick={() => { setSelectedKey(null); onPeriod(option.value); }}
              className={cn("min-h-11 rounded-lg px-4 text-sm font-semibold", period === option.value ? "bg-white text-forest-900 shadow-sm" : "text-ink-muted")}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {summary === null ? (
        <p className="mt-4 text-sm text-ink-muted">Carregando compras...</p>
      ) : summary.state === "error" ? (
        <UnavailableNote>Não foi possível carregar as compras: {summary.message}</UnavailableNote>
      ) : summary.state === "unavailable" || !ready ? (
        <div className="mt-4"><UnavailableNote>Compras indisponíveis ou sem permissão. Isso não significa que o cliente não comprou.</UnavailableNote></div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-cream-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Comprado no período</p>
              <p className="text-lg font-extrabold text-forest-950">{formatCurrency(ready.total)}</p>
            </div>
            <div className="rounded-2xl bg-cream-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Compras faturadas</p>
              <p className="text-lg font-extrabold text-forest-950">{ready.count}</p>
            </div>
          </div>
          <p className="mt-4 text-sm font-bold text-forest-950">Compras ao longo do período</p>
          <div role="img" aria-label={`Compras faturadas por ${period === "month" ? "dia" : "mês"}`} className="mt-2 flex h-40 items-end gap-1">
            {bars.map((bar) => (
              <button
                key={bar.key}
                type="button"
                onClick={() => setSelectedKey(selectedKey === bar.key ? null : bar.key)}
                aria-label={`${bar.label}: ${formatCurrency(bar.value)} em ${bar.count} compra(s)`}
                aria-pressed={selectedKey === bar.key}
                className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
              >
                <span
                  className={cn("w-full rounded-t-md transition-colors", bar.value === 0 ? "bg-forest-950/10" : selectedKey === bar.key ? "bg-gold-500" : "bg-forest-700 group-hover:bg-forest-600")}
                  style={{ height: `${Math.max(bar.value === 0 ? 3 : 8, bar.heightPercent)}%` }}
                />
                <span className="text-[10px] text-ink-muted">{bar.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-muted">Meses sem compra aparecem zerados. Clique em uma barra para consultar os pedidos aqui mesmo.</p>
          {selectedKey && (
            <div className="mt-3 rounded-2xl bg-cream-50 p-3 text-sm">
              <p className="font-bold text-forest-950">Pedidos criados em {selectedKey.split("-").reverse().join("/")} <span className="font-normal text-ink-muted">(a barra soma só pedidos faturados)</span></p>
              {detail.length === 0 ? <p className="text-ink-muted">Nenhum pedido neste período.</p> : (
                <ul className="mt-1 divide-y divide-forest-950/10">
                  {detail.map((order) => (
                    <li key={order.id}>
                      <Link to={`/admin/pedidos/${order.id}`} className="flex min-h-11 items-center justify-between gap-3">
                        <span>{order.number} · {order.date}</span>
                        <span className="flex items-center gap-2"><strong>{formatCurrency(order.total)}</strong>{order.status}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold-500/40 p-3">
            <span className="flex items-center gap-3">
              <Trophy size={22} className="text-gold-600" aria-hidden />
              <span>
                <strong className="block text-forest-950">{rankLabel(ready.rank)}</strong>
                <span className="text-xs text-ink-muted">entre {ready.rank.universe} clientes ativos · valor faturado</span>
              </span>
            </span>
            <button type="button" onClick={() => setRankOpen((v) => !v)} aria-expanded={rankOpen} className="min-h-11 rounded-xl border border-forest-900/20 px-4 text-sm font-semibold text-forest-900">Como é calculado</button>
          </div>
          {rankOpen && <p className="mt-2 rounded-2xl bg-cream-50 p-3 text-xs text-ink-700">Critério: {ready.rank.criterion}. Empates dividem a mesma posição. O universo muda com o período escolhido.</p>}
          <p className="mt-3 text-xs text-ink-muted">Compras faturadas (pedido confirmado no Financeiro), líquidas de pedidos cancelados. Devoluções ainda não entram: a fonte não está definida.</p>
        </>
      )}
    </Card>
  );
}

export function PaymentHistoryCard({ receivables, filter, onFilter }: { receivables: ApiResult<ReceivablesView> | null; filter: PaymentFilter; onFilter: (f: PaymentFilter) => void }) {
  const [showAll, setShowAll] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const ready = receivables?.state === "ready" ? receivables.data : null;
  const rows = ready ? filterPaid(ready.paid, filter) : [];
  const shown = showAll ? rows : rows.slice(0, 3);
  return (
    <Card
      title="Histórico de pagamentos"
      action={
        <select aria-label="Filtrar pagamentos" value={filter} onChange={(e) => onFilter(e.target.value as PaymentFilter)} className="h-11 rounded-xl border border-ink-900/15 bg-white px-3 text-sm">
          <option value="all">Todos os pagos</option>
          <option value="ontime">Em dia</option>
          <option value="late">Com atraso</option>
        </select>
      }
    >
      {receivables === null ? <p className="text-sm text-ink-muted">Carregando pagamentos...</p>
        : receivables.state === "error" ? <UnavailableNote>Não foi possível carregar os pagamentos: {receivables.message}</UnavailableNote>
        : !ready ? <UnavailableNote>Restrito ao seu perfil ou indisponível. Sem permissão de recebíveis a ficha não mostra pagamentos nem inventa pontualidade.</UnavailableNote>
        : (
          <>
            <p className="mb-3 text-xs text-ink-muted">Títulos quitados · desde {formatDate(ready.since)} · posição em {formatDate(ready.as_of)}</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-cream-50 p-3"><strong className="block text-lg text-forest-950">{onTimePercentLabel(ready.summary)}</strong><small className="text-ink-muted">pagos em dia</small></div>
              <div className="rounded-2xl bg-cream-50 p-3"><strong className="block text-lg text-forest-950">{ready.summary.on_time_count}</strong><small className="text-ink-muted">em dia / antecipados</small></div>
              <div className="rounded-2xl bg-cream-50 p-3"><strong className="block text-lg text-gold-600">{ready.summary.late_count}</strong><small className="text-ink-muted">pagos com atraso</small></div>
            </div>
            {ready.summary.paid_count === 0 && <p className="mt-3 text-sm text-ink-muted">Sem histórico de títulos quitados no período. Sem percentual: não há base para calcular.</p>}
            <ul className="mt-3 divide-y divide-forest-950/10">
              {shown.map((title) => (
                <li key={title.id}>
                  <button type="button" aria-expanded={openId === title.id} onClick={() => setOpenId(openId === title.id ? null : title.id)} className="flex min-h-14 w-full items-center justify-between gap-3 text-left">
                    <span className="text-sm"><strong className="block text-forest-800">{titleRowLabel(title)} →</strong><span className="text-xs text-ink-muted">Pago em {formatDate(title.paid_date)} · venceu em {formatDate(title.due_date)}</span></span>
                    <span className="flex flex-col items-end gap-1"><strong className="text-sm">{formatCurrency(title.amount)}</strong><Chip tone={title.on_time ? "neutral" : "warn"}>{paidBadge(title)}</Chip></span>
                  </button>
                  {openId === title.id && (
                    <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-cream-50 p-3 text-sm">
                      <Field label="Vencimento original" value={formatDate(title.due_date)} />
                      <Field label="Data da quitação" value={formatDate(title.paid_date)} />
                      <Field label="Meio" value={methodLabel(title.method)} />
                      <Field label="Situação" value="Quitado · saldo R$ 0,00" />
                    </dl>
                  )}
                </li>
              ))}
            </ul>
            {rows.length > 3 && <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 min-h-11 text-sm font-semibold text-forest-700 hover:underline">{showAll ? "Recolher pagamentos" : `Ver todos os ${rows.length} pagamentos`}</button>}
            <p className="mt-3 text-xs text-ink-muted">Pontualidade por quantidade de títulos quitados. Atraso usa a data efetiva da quitação; pagamento parcial não conta como quitado.</p>
          </>
        )}
    </Card>
  );
}

export function OpenTitlesCard({ receivables }: { receivables: ApiResult<ReceivablesView> | null }) {
  const ready = receivables?.state === "ready" ? receivables.data : null;
  return (
    <Card title="Boletos e títulos em aberto" action={ready && ready.open_summary.overdue_count > 0 ? <Chip tone="bad">Atenção ao crédito</Chip> : null}>
      {receivables === null ? <p className="text-sm text-ink-muted">Carregando títulos...</p>
        : receivables.state === "error" ? <UnavailableNote>Não foi possível carregar os títulos: {receivables.message}</UnavailableNote>
        : !ready ? <UnavailableNote>Restrito ao seu perfil ou indisponível.</UnavailableNote>
        : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-cream-50 p-3">
                <p className="text-xs text-ink-muted">Vencidos · {ready.open_summary.overdue_count} títulos</p>
                <strong className={cn("block text-lg", ready.open_summary.overdue_count > 0 ? "text-red-700" : "text-forest-950")}>{formatCurrency(ready.open_summary.overdue_amount)}</strong>
                <span className="text-xs text-ink-muted">{ready.open_summary.overdue_count > 0 ? `Mais antigo: ${ready.open_summary.oldest_days} dias` : "Nenhum vencido"}</span>
              </div>
              <div className="rounded-2xl bg-cream-50 p-3">
                <p className="text-xs text-ink-muted">A vencer · {ready.open_summary.upcoming_count} títulos</p>
                <strong className="block text-lg text-forest-950">{formatCurrency(ready.open_summary.upcoming_amount)}</strong>
              </div>
            </div>
            <p className="mt-3 text-xs text-ink-muted">Posição atual em {formatDate(ready.as_of)} · independente do filtro de compras</p>
            {ready.open.length === 0 ? <p className="mt-2 text-sm text-ink-muted">Nenhum título em aberto.</p> : (
              <ul className="mt-2 divide-y divide-forest-950/10">
                {ready.open.map((title) => (
                  <li key={title.id} className="flex min-h-14 items-center justify-between gap-3 py-2">
                    <span className="text-sm"><strong className="block text-forest-800">{titleRowLabel(title)}</strong><span className="text-xs text-ink-muted">Vencimento: {formatDate(title.due_date)} · {methodLabel(title.method)}{title.partial ? " · pago em parte" : ""}</span></span>
                    <span className="flex flex-col items-end gap-1"><strong className="text-sm">{formatCurrency(title.balance)}</strong><Chip tone={title.overdue ? "bad" : "neutral"}>{openBadge(title)}</Chip></span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-ink-muted">Consulta somente leitura. A baixa e o estorno de títulos acontecem no Financeiro (permissão própria), nunca nesta ficha. Quitar um título não libera outros bloqueios.</p>
          </>
        )}
    </Card>
  );
}

export function ProductsCard({ summary, onMore, loadingMore }: { summary: ApiResult<CommercialSummary> | null; onMore: () => void; loadingMore: boolean }) {
  const ready = summary?.state === "ready" ? summary.data : null;
  return (
    <Card title="Produtos mais comprados" action={ready ? <span className="text-xs text-ink-muted">{ready.products_total} produto(s) no período</span> : null}>
      {summary === null ? <p className="text-sm text-ink-muted">Carregando produtos...</p>
        : summary.state === "error" ? <UnavailableNote>Não foi possível carregar os produtos: {summary.message}</UnavailableNote>
        : !ready ? <UnavailableNote>Indisponível ou sem permissão.</UnavailableNote>
        : ready.products.length === 0 ? <p className="text-sm text-ink-muted">Nenhum produto comprado no período escolhido.</p>
        : (
          <>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {ready.products.map((product) => (
                <li key={`${product.position}-${product.name}`} className="flex gap-3 rounded-2xl border border-forest-950/10 p-3">
                  {product.image_url ? (
                    <img src={product.image_url} alt={`Foto de ${product.name}`} loading="lazy" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-forest-950/5 text-center text-[10px] text-ink-muted">Sem foto cadastrada</div>
                  )}
                  <div className="min-w-0">
                    <span className="font-mono text-xs text-gold-600">{product.position}º MAIS COMPRADO</span>
                    <strong className="block truncate text-forest-950">{product.name}</strong>
                    <span className="text-xs text-ink-muted">{Number(product.units)} unidade(s) no período</span>
                    <p className="font-bold text-ink-900">{formatCurrency(Number(product.value))}</p>
                    {product.share !== null && <span className="text-xs text-ink-muted">{Number(product.share).toLocaleString("pt-BR")}% do valor comprado</span>}
                  </div>
                </li>
              ))}
            </ul>
            {ready.products.length < ready.products_total && (
              <button type="button" onClick={onMore} disabled={loadingMore} className="mt-3 min-h-11 rounded-xl border border-forest-900/20 px-5 text-sm font-semibold text-forest-900 disabled:opacity-50">
                {loadingMore ? "Carregando..." : "Ver mais produtos"}
              </button>
            )}
            <p className="mt-3 text-xs text-ink-muted">Ranking global por valor faturado; a quantidade mostra unidades de cada produto, sem converter entre produtos diferentes.</p>
          </>
        )}
    </Card>
  );
}

export function PhotosCard({ media, urls }: { media: CustomerMedia[]; urls: Record<string, string> }) {
  const [open, setOpen] = useState<CustomerMedia | null>(null);
  const categoryLabel = { FACHADA: "Fachada", INTERIOR: "Interior", OUTRA: "Outra" } as const;
  return (
    <Card id="fotos" title="Fotos do estabelecimento" action={<span className="flex items-center gap-1 text-xs text-ink-muted"><Camera size={14} aria-hidden /> {media.length}</span>}>
      {media.length === 0 ? (
        <p className="text-sm text-ink-muted">Nenhuma foto cadastrada. Adicione fotos pelo botão Alterar.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {media.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => setOpen(item)} className="relative block aspect-[4/3] w-full overflow-hidden rounded-2xl bg-forest-950/5" aria-label={`Ampliar foto: ${item.caption || categoryLabel[item.category]}`}>
                {urls[item.storage_path] ? <img src={urls[item.storage_path]} alt={item.caption || categoryLabel[item.category]} loading="lazy" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-xs text-ink-muted">Carregando...</span>}
                {item.primary_front && <span className="absolute left-2 top-2 rounded-full bg-forest-800 px-2 py-0.5 text-[10px] font-bold text-cream-50">Fachada principal</span>}
              </button>
              <p className="mt-1 truncate text-xs text-ink-muted">{categoryLabel[item.category]}{item.caption ? ` · ${item.caption}` : ""}</p>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open !== null} onClose={() => setOpen(null)} title={open?.caption || (open ? categoryLabel[open.category] : "Foto")} wide>
        {open && urls[open.storage_path] && <img src={urls[open.storage_path]} alt={open.caption || categoryLabel[open.category]} className="max-h-[70vh] w-full object-contain" />}
      </Dialog>
    </Card>
  );
}
