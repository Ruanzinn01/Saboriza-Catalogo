# Homologação do ponto e do Meu 360 — plano de testes em dispositivo real

**Estado:** nenhum destes cenários foi executado em dispositivo real. As funções de borda `ponto-oris-terminal` (v5) e `meu360-terminal` (v2) em produção são **as versões anteriores às correções**; as versões corrigidas estão apenas no repositório local. **Não publicar antes da evidência abaixo.**

## Pré-requisito: ambiente de homologação
Não existe. O único projeto Supabase do sistema é o de produção (`saboriza`), e `time_punches`, `time_adjustments`, revisões e Espelhos são **append-only**: batidas de teste não podem ser apagadas. Opções, a decidir:
1. **Ramificação do Supabase** (`create_branch`): copia o schema, tem custo e exige confirmação.
2. **Projeto separado** com o schema recriado a partir de um baseline (que ainda não foi gerado; ver reconciliação).
Em qualquer caso: empresa e colaborador de teste, dispositivo próprio, credenciais que não sejam as de produção.

## Já validado no banco (transação com rollback, não é teste do dispositivo)
Vínculo vigente e ponto habilitado exigidos na gravação (`VINCULO_INVALIDO`, `PONTO_NAO_HABILITADO`); dia civil no fuso da empresa; ajuste que preserva a batida original; revisão, conferência, consolidação e Espelho; `IDEMPOTENCY` por chave única; negação sem permissão.

## Cenários a executar no ambiente de homologação

| ID | Cenário | Passos | Resultado esperado | Evidência a anexar |
|---|---|---|---|---|
| H01 | Batida normal | matrícula → PIN → tipo → foto → confirmar | `punch_id` devolvido só depois de gravar; 1 linha em `time_punches`; foto no bucket; evento `punch.recorded` | resposta da função, linha, objeto, evento |
| H02 | Repetição com a mesma chave | reenviar o mesmo envelope | mesmo `punch_id`, nenhuma linha nova | contagem de linhas |
| H03 | Falha de rede depois da gravação | gravar, cortar a resposta, tentar de novo no aparelho | a tentativa recupera o mesmo `punch_id`; a tela só mostra sucesso após a confirmação | log do aparelho + banco |
| H04 | Chave reutilizada por outro colaborador | mesma `idempotency_key`, outro `employee_id` | 409 `IDEMPOTENCY_CONFLICT`; nunca devolve a batida alheia | resposta |
| H05 | Foto já enviada, gravação falhou | simular upload feito e insert recusado; repetir | reaproveita a foto sem sobrescrever e grava a batida | objeto (hash igual) |
| H06 | Colaborador inativo | desligar e tentar bater | 404 na identificação; recusa na batida | resposta |
| H07 | Ponto não habilitado | `timesheet_enabled = false` | identificação funciona; batida 403 `PONTO_NAO_HABILITADO` | resposta |
| H08 | Vínculo encerrado / sem vínculo | período fechado ou data anterior à admissão | 403 `VINCULO_INVALIDO`; sem foto gravada | resposta e storage |
| H09 | Recontratação | desligar, reativar com nova data | período 2 aberto, período 1 intacto; nova batida no período 2 | linhas de `employee_employments` |
| H10 | Dispositivo revogado | revogar o aparelho no meio do fluxo | 401 na batida, mesmo se a identificação veio antes | resposta |
| H11 | Unidade diferente | colaborador de outra unidade | recusa | resposta |
| H12 | PIN errado e limite | errar o PIN repetidamente | 401 e depois 429 | respostas |
| H13 | Relógio do aparelho divergente | aparelho com horário errado | `server_time` oficial; `device_reported_time` só como evidência | linha |
| H14 | Meia-noite e fuso | bater 22:30–23:30 local | dia civil local correto na apuração | `oris360_apurar_dia_detalhado` |
| H15 | Sincronização | após a batida, abrir a apuração e gerar revisão | batida aparece no dia certo; revisão reflete | revisão gerada |
| H16 | Autorização | usuário sem `timesheet.apuracao.manage` | não gera revisão, ajuste nem Espelho; leitura devolve nulo | respostas |
| H17 | Cadastro do aparelho | usuário com mais de uma empresa, sem informar a empresa; e com empresa de que não é membro | 400 e 403; nunca "a primeira empresa" | respostas |
| H18 | Meu 360: avançar sem ter assumido | outro colaborador tenta avançar/concluir | 403; execução inalterada | resposta |
| H19 | Meu 360: erro visível | forçar falha da ação | a tela mostra o erro; nenhuma "conclusão" falsa | captura |

## Como apresentar a evidência
Por cenário: ambiente, revisão do código publicada, empresa/colaborador de teste, IDs gerados, resposta bruta, estado final do banco e resultado (aprovado/reprovado). A publicação em produção só depois de H01–H19 aprovados e do aval do cliente.
