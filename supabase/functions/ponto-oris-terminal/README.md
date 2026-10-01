# ponto-oris-terminal

Terminal de batida de ponto online. Roda num tablet/dispositivo
pareado por empresa — não exige login individual do colaborador, só
matrícula + PIN + foto. Nenhuma batida é mostrada como concluída antes
da confirmação do servidor.

**Segurança:** `company_id`/`unit_id` nunca vêm do payload — são sempre
resolvidos a partir do dispositivo autorizado (`time_devices.credential_hash`,
comparado via SHA-256). `verify_jwt: true`, mas as ações de uso diário
(`identify`/`punch`) não exigem JWT de usuário — o client Supabase manda a
anon key como portador, que já satisfaz o `verify_jwt` da plataforma.

**Invocação:** `POST` com body `{ "action": "<nome>", ...campos }`.

| action | campos | quem chama | retorno |
|---|---|---|---|
| `register-device` | `label`, `unit_id?` | admin logado com `timesheet.devices.manage` (JWT obrigatório) | `device_id` + `device_credential` em texto puro (única vez — só o hash fica salvo) |
| `set-employee-pin` | `employee_id`, `pin` (mín. 4 dígitos) | admin logado com `timesheet.apuracao.manage` | `{ ok: true }` |
| `identify` | `device_id`, `device_credential`, `employee_code` | terminal (sem login) | `employee_id` + `first_name` |
| `punch` | `device_id`, `device_credential`, `employee_id`, `pin`, `type` (ENTRADA/INTERVALO/RETORNO/SAIDA), `photo_base64`, `idempotency_key` | terminal (sem login) | `punch_id`, `server_time`, `type` — idempotente por `idempotency_key` |
| `get-photo-url` | `photo_path` | admin logado com `timesheet.apuracao.read` | URL assinada (5 min) da foto de evidência no bucket privado `oris360-private` |

**Idempotência:** `punch` com a mesma `idempotency_key` sempre retorna a
mesma batida já confirmada — nunca duplica, mesmo em retry de rede ou
corrida entre duas requisições simultâneas.

**Rate limiting:** PIN tem no máximo 5 tentativas erradas por `device_id` a
cada 5 minutos (ver `checkPinRateLimit` no código) — depois disso retorna
`429` até a janela expirar. Protege contra força bruta de PIN num
dispositivo físico comprometido.
