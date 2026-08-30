# Runbook — Key rotation

Rotate in this order to avoid downtime:

## 1. AUTH_MANAGER_SECRET

1. Generate new secret (32+ random bytes)
2. Update root `.env` on prod-mini: `AUTH_MANAGER_SECRET=...`
3. Update `auth_manager` container env (via compose regen)
4. Store in secrets_manager as `auth.signing_secret` if using envelope storage
5. Redeploy conductor + auth_manager
6. App credentials: rotate each via Auth Manager UI (old secrets stop immediately)

## 2. JWT_SECRET / TOKEN_SECRET (conductor human login)

`NODE_ENV=production` **throws** if `TOKEN_SECRET` is dummy. Rotate live `.env` on the box, then restart conductor. Deploy scripts do not rewrite `.env`.

1. Update `.env`
2. Redeploy conductor
3. All human sessions invalidated — users re-login

## 3. KEY_MANAGER_MASTER_KEY

**Destructive if wrong** — only rotate with storage/secrets re-encryption plan.

1. Backup conductor + all manager SQLite volumes
2. Plan re-wrap of secrets_manager envelopes
3. Contact ops before rotating MASTER_KEY in production

## 4. Cloudflare tokens

- Tunnel API token: `cloudflare.api_token` in secrets_manager
- Zero Trust Access: separate token — see [edge_stack_pro.md](../plans/edge_stack_pro.md)
