import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/admin/estoque/EstoquePrimitives";
import { formatDateTime } from "@/lib/inventory";
import { formatNumber } from "@/lib/number";
import { useEstoqueStore } from "@/store/estoque-store";

interface Connection {
  key: string;
  name: string;
  event: string;
  effect: string;
  rule: string;
  to: string;
  live: boolean;
}

// Contrato de cada origem, como no mapa de conexões do protótipo; o estado vem do banco real.
const CONNECTIONS: Connection[] = [
  { key: "compras", name: "Compras e Despesas", event: "Recebimento confirmado", effect: "Entrada de insumos / mercadorias", rule: "Registrar compra ou pagar não gera entrada física.", to: "/admin/despesas", live: true },
  { key: "producao", name: "Produziu Registra", event: "Fechamento oficial confirmado", effect: "Entrada de produção acabada", rule: "Liberar produção não cria estoque. Conversão de pack ocorre uma vez.", to: "/admin/produzir", live: true },
  { key: "chao_fabrica", name: "Chão de Fábrica", event: "Execução e consumo produtivo", effect: "Contexto, WIP e consumo conforme serviço oficial", rule: "Concluir execução não cria uma segunda entrada de acabado.", to: "/admin/chao-de-fabrica", live: true },
  { key: "separa_confere", name: "Separa Confere", event: "Finalizar Conferência", effect: "Saída da quantidade conferida", rule: "Faturar e entregar não baixam novamente.", to: "/admin/separa-confere", live: true },
  { key: "entrega", name: "Entrega Registra", event: "Entrega finalizada / retorno conferido", effect: "Demanda realizada / retorno físico", rule: "Cancelamento sozinho não devolve disponível.", to: "/admin/carrega-entrega", live: true },
  { key: "financeiro", name: "Financeiro Geral", event: "Projeções de custo e reposição", effect: "Indicadores e estimativas", rule: "Estoque a custo não é caixa. Sugestão não é conta a pagar.", to: "/admin/financeiro-geral", live: false },
  { key: "produtos", name: "Produtos / Ficha técnica", event: "Cadastro e versões oficiais", effect: "Identidade, unidade, pack e composição", rule: "Não duplicar cadastros ou recalcular histórico fechado.", to: "/admin/produtos", live: true },
  { key: "pdf", name: "Painel do Proprietário / Central de PDFs", event: "Indicadores e relatório fechado", effect: "Visão autorizada e arquivo por competência", rule: "Preservar empresa, período, fonte e permissões.", to: "/admin/painel-proprietario", live: false },
];

export function EstoqueConexoes() {
  const integrations = useEstoqueStore((s) => s.integrations);
  const fetchIntegrations = useEstoqueStore((s) => s.fetchIntegrations);

  useEffect(() => {
    void fetchIntegrations();
  }, [fetchIntegrations]);

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl bg-forest-950/5 p-3 text-xs leading-relaxed text-forest-900">
        Mapa das conexões do ecossistema. Um fato nasce na sua origem e produz efeitos identificáveis, sem repetir movimentos. O estado de cada origem abaixo vem dos registros reais.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {CONNECTIONS.map((connection) => {
          const status = integrations.find((row) => row.originKey === connection.key);
          const badge = !connection.live
            ? connection.key === "pdf"
              ? { label: "Central de PDFs: integração ainda não existe", className: "bg-ink-900/10 text-ink-700" }
              : { label: "Somente indicadores", className: "bg-blue-500/10 text-blue-700" }
            : status && status.pending > 0
              ? { label: `${formatNumber(status.pending)} pendente${status.pending > 1 ? "s" : ""}`, className: "bg-amber-100 text-amber-800" }
              : status && status.lastEventAt
                ? { label: "Confirmado", className: "bg-forest-950/10 text-forest-950" }
                : { label: "Sem eventos", className: "bg-ink-900/10 text-ink-700" };
          return (
            <Card key={connection.key} title={connection.name}>
              <div className="flex flex-col gap-2 p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold text-blue-700">{connection.event}</span>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${badge.className}`}>{badge.label}</span>
                </div>
                <p><b>{connection.effect}</b></p>
                <p className="text-ink-muted">{connection.rule}</p>
                {connection.live && (
                  <p className="text-xs text-ink-muted">
                    {status && status.lastEventAt ? `Último evento ${formatDateTime(status.lastEventAt)} · ${formatNumber(status.events30d)} nos últimos 30 dias` : "Nenhum evento registrado ainda."}
                  </p>
                )}
                <div><Link to={connection.to} className="text-xs font-bold text-forest-700 underline">Abrir origem →</Link></div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card title="Estado de comunicação">
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Confirmado", "Fato persistido", "Origem e movimento associados.", "bg-forest-950/10 text-forest-950"],
            ["Pendente", "Aguardando efeito", "Não inventar saldo ou sucesso.", "bg-amber-100 text-amber-800"],
            ["Falha", "Tratamento visível", "Reprocessar com a mesma identidade. Nenhuma falha registrada.", "bg-red-100 text-red-700"],
            ["Atualizado", "Projeções em tempo real", "Conferir estado ao reconectar.", "bg-blue-500/10 text-blue-700"],
          ].map(([badge, title, text, className]) => (
            <div key={badge} className="rounded-xl border border-forest-950/10 bg-cream-50 p-3 text-xs">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${className}`}>{badge}</span>
              <b className="mt-2 block text-sm">{title}</b>
              <span className="text-ink-muted">{text}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
