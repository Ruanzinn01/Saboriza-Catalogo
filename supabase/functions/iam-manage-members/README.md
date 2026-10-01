# iam-manage-members

Gestão de usuários por empresa (convite, revogação, papéis). Usa a Auth
Admin API do Supabase (service role) pra criar/convidar usuário — por isso
não dá pra fazer isso direto do client com RLS normal.

**Auth:** `verify_jwt: true`. Chamadas precisam do JWT do usuário logado no
header `Authorization` — a empresa do caller é resolvida pela membership
ativa dele, nunca vem no payload.

**Invocação:** `POST` com body `{ "action": "<nome>", ...campos }`.

| action | campos | permissão exigida | retorno |
|---|---|---|---|
| `invite` | `email`, `role_id` | `iam.members.manage` | convida usuário via Auth Admin API + cria membership `PENDING` |
| `revoke` | `membership_id` | `iam.members.manage` | marca membership como `REVOKED` |
| `list-roles` | — | — (só precisa estar autenticado na empresa) | lista roles da empresa |
| `create-role` | `name`, `permission_keys[]` | `iam.roles.manage` | cria role nova com permissões |
| `update-role-permissions` | `role_id`, `permission_keys[]` | `iam.roles.manage` | substitui o conjunto de permissões de uma role |
| `update-member-role` | `membership_id`, `role_id` | `iam.members.manage` | troca a role de um membro |

**Erros:** `401` sem JWT, `403` sem empresa ativa ou sem a permissão exigida (checada via `oris360_has_permission`), `400` payload inválido.
