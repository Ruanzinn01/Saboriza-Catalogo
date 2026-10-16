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
9. Teste de navegador (H01–H19, seção 7): BLOQUEADO nesta sessão (sem Claude in Chrome nem navegador embutido; o embutido não abre localhost do shell). Recomendação: abrir uma sessão com Claude in Chrome habilitado e rodar `npm run dev` com `.env.local` da homologação. Substituto parcial em andamento: teste por API real.
