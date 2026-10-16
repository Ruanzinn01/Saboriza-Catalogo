# Decisões pendentes (só o responsável pode tomar)

Cada item: pergunta, recomendação, estado.

1. Aplicar em produção `180000, 181000, 221500, 224500, 223000 fase A`, depois salário/Pix 1 e 2, storage multiempresa, crédito, apps isolados. Recomendação: só após homologação completa e front publicado. NÃO executado.
2. Branch de homologação do Preview da Vercel + push; confirmar integração GitHub↔Supabase e Ignored Build Step no painel. NÃO executado.
3. Publicar frontend (merge na main) e separar commits de outras sessões. NÃO executado.
4. Fase B (bloqueio direto no banco ao operador só-Separa) após front no ar.
5. Restringir comprovantes de entrega ao app Entrega.
6. Roles que recebem `producao.operar`, `entrega.operar`, `admin.acessar`; separador conta inventário?
7. Manter ou desligar cron jobs da homologação; recursos pagos.
8. Testes em aparelho real (roteiro será preparado).
13. Teste de navegador (H01–H19, seção 7): BLOQUEADO nesta sessão (sem Claude in Chrome nem navegador embutido; o embutido não abre localhost do shell). Recomendação: abrir uma sessão com Claude in Chrome habilitado e rodar `npm run dev` com `.env.local` da homologação. Substituto parcial em andamento: teste por API real.
9. Escopo por unidade não aplicado pelo RLS (21 tabelas, ver `docs/apps-operacionais/MATRIZ_ISOLAMENTO_AMPLIADA.md`). Pergunta: exigir política restritiva por unidade antes da primeira empresa com filial? Recomendação: sim, antes de qualquer multiunidade em produção. NÃO executado.
10. Entregador lê todos os pedidos da empresa (sem vínculo carga/entregador). Pergunta: o app Entrega deve restringir a "minhas cargas"? Recomendação: criar vínculo e política se for requisito; senão registrar como aceito.
11. Anônimo lê `companies` (razão social e documento), `products`, `settings`, `coupons` de todas as empresas. Pergunta: publicar só colunas de vitrine por view? Recomendação: sim para `companies`; manter catálogo.
12. Login real dos usuários `rot-producao@`, `rot-entrega@`, `rot-multi@`, `rot-unidade@` (criados sem senha). Pergunta: o responsável define senhas em `C:\Users\rruan\homolog-credenciais.txt` para o teste por navegador/API? Recomendação: sim, antes da homologação com navegador real.

## DP-GRANTS-1 — RPCs SECURITY DEFINER sem checagem de empresa/permissão (levantadas em 2026-10-15, produção só leitura)
Pergunta: autoriza criar migration que adicione, no corpo, checagem de membro/permissão da empresa em adjust_stock, confirm_raw_material_entry, create_stock_entry, floor_advance_quantity, floor_assume_execution, floor_complete_execution, create_production, reverse_production e update_order_items? Hoje qualquer usuário autenticado de QUALQUER empresa pode executá-las (DEFINER ignora RLS).
Recomendação: sim, uma onda própria com teste PGlite multiempresa; para create_production e reverse_production (sem uso no front), a alternativa mais simples é revogar EXECUTE também de authenticated. Antes, confirmar com o dono que nenhum app operacional externo as chama.

## DP-GRANTS-2 — RPCs que exigem apenas "membro ativo"
Pergunta: inventory_begin_count, inventory_register_count, inventory_session_items, purchase_catalog, stock_integration_status, stock_lots, stock_position devem exigir permissão específica (ex.: estoque.*)? Podem ser intencionais para operador restrito.
Recomendação: manter por ora; revisar com o mapa de permissões do operador antes de endurecer.

## DP-SAL-1 — Fase 2 de salário/Pix muda a regra de update_employee_salary
Pergunta: confirma que, na fase 2, quem tem só despesas.manage (papel criado depois da fase 1) perde o direito de alterar salário?
Recomendação: sim (é o objetivo), e aplicar só depois do front publicado (ver docs/seguranca/SALARIO_PIX_FASE2_CONDICAO.md).
