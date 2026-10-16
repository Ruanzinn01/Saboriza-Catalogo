-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260928201113 · md5 normalizado 6641960796b573c7932a0fc21629a1bf · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
-- Correção obrigatória: remove o resquício da antiga experiência de "Central de Implantação"
-- (percentual/checklist/"Em implantação"), extinta por decisão posterior do proprietário.
-- A tabela onboarding_checklists veio do patch original da Fundação Mestre; nunca foi exposta
-- em rota/menu/dashboard do frontend (auditado: zero referência em src/). O único resquício real
-- era a linha seed marcando a Saboriza como "IN_PROGRESS" de implantação, o que já é factualmente
-- errado (empresa em operação plena). Removendo a linha; mantendo a tabela como infraestrutura
-- técnica interna (não usuário-facing), documentado via comentário.

begin;

delete from public.onboarding_checklists;

comment on table public.onboarding_checklists is
  'Infraestrutura técnica interna, NÃO é a antiga Central de Implantação (extinta por decisão do proprietário em 2026-09-28). Nunca deve virar percentual/checklist obrigatório exibido ao usuário final, nem gate de liberação de módulo. Se usada no futuro, é só para acompanhamento técnico de suporte/ativação de recurso específico, nunca ressuscitando a experiência antiga.';

commit;
;
