# Ambiente de homologação — alternativas e custo

**Nada foi contratado, criado ou configurado.** Este documento só compara opções para decisão. Valores do Supabase vêm da documentação oficial consultada em 14/10/2026 e da API de custos (`get_cost`); impostos locais podem se somar.

## Situação atual
- Um único projeto Supabase (`saboriza`, `opeietrhbqlhrhljcdtx`), organização **RE-Digital no plano Free**, sem branches.
- Banco de 26 MB; 185 migrations no histórico (`supabase_migrations.schema_migrations`, ~1,05 MB de SQL). O repositório só tem as mais recentes, mas **o histórico completo existe no banco** e pode ser lido (somente leitura) para recriar o schema.
- Vercel: variáveis `VITE_SUPABASE_*` existem **apenas para Production**. Um preview de branch hoje não tem backend. Não foi configurado Preview apontando para produção e não será.
- Máquina local: sem Docker, sem Supabase CLI, sem `psql`; 14,9 GB de RAM; 11,8 GB livres em disco.

## Opção A — branch do Supabase
- **Requisito:** branching é recurso do plano **Pro** (US$ 25/mês por organização, cobrados antecipadamente).
- **Custo da branch:** sem taxa fixa; computação Micro a **US$ 0,01344/hora** e egress/disco conforme uso. Os US$ 10 de crédito de computação **não** cobrem branch.
- **Estimativas** (só a branch): sessão de 8 h ≈ US$ 0,11; 1 semana ligada ≈ US$ 2,26; 1 mês ligada ≈ US$ 9,81. Acrescentar os US$ 25 do Pro (proporcional ao período, sem reembolso; saldo vira crédito) e eventuais impostos.
- **Efeito colateral:** o upgrade vale para a organização inteira (o projeto de produção passa a não pausar por inatividade; sua computação Micro entra no crédito de US$ 10).
- **Desligamento:** apagar a branch (cobrança cessa após a hora corrente); remover variáveis de Preview na Vercel; rebaixar a organização para Free se não for mais usar o Pro. Banco de 26 MB cabe no limite do Free (500 MB).
- **Fidelidade:** alta (aplica as migrations do histórico em banco novo, sem dados de produção); Auth, PostgREST, Realtime e HTTPS reais.
- **Risco:** exige aprovação de gasto; depende de a replicação do histórico passar.

## Opção B — projeto Supabase separado (plano Free)
- **Custo:** US$ 0/mês segundo `get_cost(project)` para esta organização. Limite do Free: 2 projetos ativos por conta (somando organizações em que se é Owner/Admin) — **não consegui confirmar quantos já existem na conta**; se estourar, a criação falha.
- **Restrições:** pausa por baixa atividade em 7 dias (reativável por até 90 dias); 500 MB de banco; sem backups gerenciados.
- **Trabalho:** recriar o schema reproduzindo as 185 migrations lidas do histórico de produção (somente leitura em produção; escrita só no projeto novo), com risco em itens que dependem de extensões, `pg_cron`, Vault e dados semeados. Semear dados sintéticos (empresas A e B, operadores, gestor).
- **Fidelidade:** boa se a replicação passar; Auth, PostgREST, Realtime e HTTPS reais → permite **chamadas HTTP com JWT real**.
- **Front para teste em aparelho:** variáveis de Preview na Vercel (somente alvo Preview, apontando para o projeto novo) e o preview é protegido por SSO da Vercel (o testador precisa de login ou de um bypass autorizado).
- **Desligamento:** pausar ou excluir o projeto; remover variáveis de Preview.

## Opção C — ambiente local isolado
- **Custo:** US$ 0 (software); instalar Docker Desktop (licença gratuita para uso pequeno) e Supabase CLI.
- **Viabilidade nesta máquina:** possível, mas apertada: as imagens do stack local ocupam alguns GB num disco com 11,8 GB livres, mais WSL2.
- **Fidelidade:** Auth/PostgREST/Realtime reais **localmente** (HTTP + JWT), mesma necessidade de replicar as 185 migrations. **Sem HTTPS público**: não serve para o teste de câmera e instalação em celular (precisa de túnel ou rede local com certificado).
- **PGlite (sem Docker):** só SQL. Não oferece HTTP, JWT, Realtime nem PostgREST; é o que a outra frente usou com schema sintético.

## Comparação
| Critério | A. Branch | B. Projeto Free | C. Local (Docker) | PGlite |
|---|---|---|---|---|
| Custo | US$ 25 + ~US$ 0,32/dia ligada | US$ 0 | US$ 0 | US$ 0 |
| Autorização de gasto | necessária | não, se houver vaga no limite | não | não |
| HTTP + JWT reais | sim | sim | sim (local) | não |
| Realtime real | sim | sim | sim (local) | não |
| HTTPS / celular real | sim (com Preview) | sim (com Preview) | não | não |
| Fidelidade ao schema | alta | boa (depende da replicação) | boa | baixa (sintético) |
| Esforço | baixo | médio/alto | alto (instalação) | baixo |

## Recomendação
1. **B** primeiro (custo zero, cobre HTTP+JWT, Realtime e aparelho). Pré-requisito: confirmar a vaga no limite de projetos Free.
2. **A** se B falhar na replicação ou no limite; só com sua autorização expressa do custo acima.
3. **C** apenas se quiser repetibilidade local; não cobre o teste em celular.
Nenhuma delas será criada sem a sua autorização.
