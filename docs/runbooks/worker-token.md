# Worker registration token rotation

Settings → regenerate token used to invalidate every worker immediately. That is fixed:

- Old + new tokens are both valid for `WORKER_TOKEN_OVERLAP_HOURS` (default 24).
- After the window, the old token expires.
- Optional per-device token: register with a dedicated token and rotate one box at a time.

## Rotate without orphaning the fleet

1. In console Settings, regenerate. Copy the new token.
2. Update `WORKER_REGISTRATION_TOKEN` on each host `.env` (humans edit; rsync does not overwrite).
3. Restart that worker only (`docker compose ... up -d --no-deps worker`).
4. After every box has the new value, wait out the overlap or revoke remaining old tokens.

Do not click regenerate during an incident until you can update every host `.env`.
