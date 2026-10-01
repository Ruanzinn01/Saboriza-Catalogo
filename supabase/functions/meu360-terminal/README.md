# meu360-terminal

Sessão pessoal do colaborador no Chão de Fábrica (Meu 360 V4) — view nativa,
sem iframe. Reaproveita o mesmo dispositivo pareado do Ponto Óris
(`time_devices`) em vez de criar uma segunda infraestrutura de
autenticação: o PIN é o mesmo `employees.timesheet_pin_hash`.

**Segurança:** `company_id` nunca vem do payload — resolvido pelo
dispositivo. `verify_jwt: true`, mas as ações não exigem JWT de usuário (anon
key basta, igual ao terminal de ponto). PIN é revalidado em toda ação
crítica (`session`, `do`), não só uma vez no login.

**Invocação:** `POST` com body `{ "action": "<nome>", ...campos }`.

| action | campos | retorno |
|---|---|---|
| `identify` | `device_id`, `device_credential`, `employee_code` | `employee_id` + `first_name` (só se `meu360_enabled = true`) |
| `session` | `device_id`, `device_credential`, `employee_id`, `pin` | `employee_name` + lista de `floor_executions` disponíveis/assumidas + `products` da empresa |
| `do` | `device_id`, `device_credential`, `employee_id`, `pin`, `floor_execution_id`, `op` (`assumir`/`avancar`/`concluir`), `quantity_delta?` (só pra `avancar`) | execução atualizada — proxy direto pras RPCs `floor_assume_execution`/`floor_advance_quantity`/`floor_complete_execution` |

**Rate limiting:** mesmo esquema do `ponto-oris-terminal` — 5 tentativas de
PIN erradas por `device_id` a cada 5 minutos, depois `429`.

**Fora de escopo:** não movimenta estoque nenhuma dessas ações — `assumir`/`avancar`/`concluir`
são só o Chão de Fábrica. Quem fecha o produto acabado é o Produziu Registra.
