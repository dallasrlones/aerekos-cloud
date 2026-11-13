# Privacy and data handling

aerekos-cloud is self-hosted. **You** operate the appliance; we do not receive your fleet data.

## What stays on your hosts

- Conductor control DB (projects, users, stack revisions)
- Manager SQLite / volumes (objects, secrets envelopes, logs samples)
- Worker Docker state and container filesystems
- Icarus agent memory / corpus under configured paths

## What must not ship in public mirrors

See [`scripts/oss/mirror-denylist.txt`](../scripts/oss/mirror-denylist.txt): `.env`, bucket dumps, and personal product apps (`aerekos-tv`, `aerekos-music`, `aerekos-drive`, `forged-lumen`).

## Operators

- Prefer `MOCK_KEY_MANAGER=false` with real key_manager in shared environments ([runbooks/mock-key-manager-prod.md](runbooks/mock-key-manager-prod.md) when present).
- Rotate secrets per [runbooks/key-rotation.md](runbooks/key-rotation.md).
- Default admin seed only when `ALLOW_DEFAULT_ADMIN_SEED=1`.
